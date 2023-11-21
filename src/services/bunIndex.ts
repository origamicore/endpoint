import { MessageModel, RouteResponse, Router } from "@origamicore/core";
import EndpointConnection from "../models/endpointConnection";
import ErrorMessages from "../models/errorMessages";
import IpController, { ServiceLimit } from "../models/ipController";
import QueueController from "../models/queueController";
import QueueControl from "../modules/queueControl";
import fs from 'fs'
import SessionManager from "../sessionManager/sessionManager";
import RamsSessionManager from "../sessionManager/ramSessionManager";
import JwtSessionManager from "../sessionManager/jwtSessionManager";
import RedisSessionManager from "../sessionManager/redisSessionManager";
import Authorization from "../modules/authorization";
import AuthzEndpoint from "../models/authzEndpoint";
var allService:ServiceLimit;
var byDomain:Map<string,ServiceLimit> ;
var byService:Map<string,ServiceLimit> ;
var haveIpcontroller:boolean;
var ips:Map<string,ServiceLimit>=new Map<string,ServiceLimit>();
 export default class BunIndex
 {
    config:EndpointConnection
    sessionManager:SessionManager;
    constructor(config:EndpointConnection)
    {
        this.config=config;
    }
    init(ipController?:IpController,queueController?:QueueController)
    {
        if(ipController?.limits.length)
        {
            allService=ipController?.limits.filter(p=>!p.domain && !p.service)[0]
            let bydomain=ipController?.limits.filter(p=>p.domain && !p.service)
            for(let s of bydomain)
            {
                if(!byDomain)byDomain=new Map<string,ServiceLimit>();
                byDomain.set(s.domain,s);
            }
            let byservice=ipController?.limits.filter(p=>p.domain && p.service)
            for(let s of byservice)
            {
                if(!byService)byService=new Map<string,ServiceLimit>();
                byService.set(s.domain+'*'+s.service,s);
            }
            haveIpcontroller=true

        }
        
        let qcontrol:QueueControl;
        if(queueController)
        {
            qcontrol=new QueueControl(queueController);
        } 
        let self=this;
        let tls:any={}
        if(this.config.protocol.type=='https')
        {
            tls={
                // @ts-ignore
                cert: Bun.file(this.config.protocol.crt),
                // @ts-ignore
                key: Bun.file(this.config.protocol.key),
              }
        }

        // @ts-ignore
        Bun.serve({
            port: this.config.protocol.port,
            maxRequestBodySize:this.config.limit?.bodyLimit ?? 100*1024,
            reusePort:true,

            tls,
            async fetch(req:Request, server) {
                const path = new URL(req.url)
                let body=JSON.parse(JSON.stringify(path.searchParams)) 
                let sp=path.pathname.split('/')  
                let file= self.getPublic(path,self.config.publicFolder)
                if(file)
                {
                    return file
                }
                try{
                    let json=await req.json(); 
                    Object.assign(body,json)
                }catch(exp){}
                let domain=sp[1]
                let service=sp[2]  
                let ipData=await server.requestIP(req)
                if(ipData)
                    if(!self.checkIp((ipData).address,{domain,service})) 
                    {
                        return new Response(ErrorMessages.tooManyRequests,{status:429});  
                    }
                if(!domain || !service )
                {
                    return new Response(ErrorMessages.notFound,{status:404});
                }
                var route = Router.getRouteData(domain,service);  
                if(!route)
                {
                    return new Response(ErrorMessages.notFound,{status:404});
                }
                if(Array.isArray(route))
                {
                    if(!route.filter(p=>p.method==req.method)[0])
                    {
                        return new Response(ErrorMessages.notFound,{status:404});
                    }
                } 
                let session:any=null;
                try{
                    session= await self.getSession(req)

                }catch(exp){} 
                let isAuthz = false;
                if(self.config.authz)
                { 
                    try{
                        isAuthz =await self.checkAuthz(session,{domain,service,body,path:path.pathname},self.config.authz);					
                    }catch(exp)
                    {
                        console.log('exp>>',exp)
                    }
                }
                else
                {
                    isAuthz = Authorization.checkAuthorization(domain,service,session,req.method);
                }
                if(!isAuthz) 
                    return new Response(ErrorMessages.authz,{status:403}); 
                
                if(qcontrol)
                {
                    let checkQueue= qcontrol.check(domain,service,session)    
                    if(!checkQueue)
                    {
                        return new Response(ErrorMessages.limit,{status:403});  
                    } 
                }

                try{
                    
                    var responseData=await Router.runExternal(domain,service,new MessageModel(body),path.pathname,req.method);
                    
                    var token= await self.setSession(req,responseData,session);
                    var addedResponse=responseData?.addedResponse;
                    if(addedResponse)
                    {
                        if(responseData.addedResponse.redirect) 
                            throw 'Redirect not supported'
                        
                        if(responseData.addedResponse.directText)
                            return new Response(responseData.addedResponse.directText,{status:200});  
    
                        if(addedResponse.directFileDownload)
                        {
                            fs.readFile(addedResponse.directFileDownload,function(err, downloadData){ 
                                if(responseData.addedResponse.type)
                                {
                                    req.headers.set( 'Content-Type', responseData.addedResponse.type ) 
                                }
                                return new Response(downloadData,{status:200,headers:{'Content-Type':responseData.addedResponse.type}});   
                            })
                            return
                        } 
                    }
                    if(responseData.error)
                    {
                        return new Response(JSON.stringify(responseData.error) ,{status:500}); 
                    } 
    
                    var resp:any= responseData.response??{};       
                    
                    if(token)
                        resp.token=token;
                    req.headers.set( 'Content-Type', 'application/json; charset=utf-8' ) 
                    return new Response(JSON.stringify(resp) ,{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}});  
                }
                catch(exp)
                {
                    console.log('exp>>',exp) 
                    return new Response(JSON.stringify({message:exp}) ,{status:500}); 
                }
                  
            },
          });
          
          console.log("\x1b[32m%s\x1b[0m",'Bun run at port '+ this.config.protocol.port);
    }
    
    checkIp(ip:string,data)
    {
        if(!haveIpcontroller)return true;
        let now=new Date().getTime() 
        if(this.config.debug) console.log( ip );

        let key=ip+'_';
        let check=byService?.get(data.domain+'*'+data.service) ;
        if(!check)
        {
            check=byDomain?.get(data.domain) 

            if(!check)
            {
                check=allService
            }
            else
            {
                key+=data.domain ;
            }
        }
        else
        {
            key+=data.domain+'*'+data.service 

        }  
        
        if(check) 
        { 
            let exist=ips.get(key)
            if(exist)
            {
                
                if(exist.delayPerSec<now)
                {
                    exist.count=0;
                    exist.delayPerSec=now+check.delayPerSec*1000
                }
                exist.count++; 
                if(exist.count>check.count)
                { 
                     
                     return false
                }
            }
            else
            {
                ips.set(key,new ServiceLimit({
                    count:0,
                    delayPerSec:now+check.delayPerSec*1000

                }))
            } 
        }
        return true
    }
	async setSession(req:Request,data:RouteResponse,sessionData:any)
	{ 
		var token = req.headers.get('authorization')  
        
		if(data?.session)
		{
            if(!sessionData)
                sessionData={}  
            for(var name in data.session)
            {
                if(data.session[name]==null)
                    delete sessionData[name]
                else {
                    sessionData[name]= data.session[name]
                }
            }
            delete data.session
			var key= await this.sessionManager.setSession(token,sessionData) 
			return key;
		}
		return "";
	}

	async checkAuthz(session,dt,authz:AuthzEndpoint):Promise<boolean>
    { 
        return new Promise( async(res,rej)=>{            
            if(session && session.superadmin)
                return res(true)
            try{ 
                var data= Router.runInternal(authz.domain,'checkRole',new MessageModel({data:{domain:dt.domain,service:dt.service},session:session})
                );
                res(!!data)
            }catch(exp){

                    return res(false)
            }
             
        })
    }
    async setSessionManager(config:EndpointConnection)
    {
        if(config.protocol.redisConfig)
        { 
            this.sessionManager=new RedisSessionManager();
            await this.sessionManager.init(config.protocol.redisConfig);
        }
        else if(config.protocol.jwtConfig)
        {
            this.sessionManager=new JwtSessionManager();
            await this.sessionManager.init(config.protocol.jwtConfig);
        }
        else
        {
            this.sessionManager=new RamsSessionManager();
            await this.sessionManager.init({});
        } 
    }
    async getSession(req:Request)
    {
        var token = req.headers.get('authorization');
        if(token)
        {
            return await this.sessionManager.getSession(token) 

        }
        return null;
    }
	getPublic(path:URL,publicFolder:string[])
    { 
        if(!path.pathname)return null
        
        for(var folder of publicFolder)
        {
            const filePath=folder+path.pathname 
            let state=fs.lstatSync(filePath)
             
            if(state.isFile())
            {
                // @ts-ignore
                const file = Bun.file(filePath);
                return new Response(file);
            }
        }
        return null
    }
 }