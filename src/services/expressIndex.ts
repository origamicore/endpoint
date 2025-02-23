import EndpointConnection from "../models/endpointConnection";
import JwtSessionManager from "../sessionManager/jwtSessionManager";
import RamsSessionManager from "../sessionManager/ramSessionManager";
import RedisSessionManager from "../sessionManager/redisSessionManager";
import SessionManager from "../sessionManager/sessionManager";
import {Router,MessageModel,RouteResponse,ExtrnalService, HttpMethod} from '@origamicore/core' 
import AuthzEndpoint from "../models/authzEndpoint";  
import ErrorMessages from "../models/errorMessages";
import Authorization from "../modules/authorization";
import UploadFileModel from "../models/uploadFileModel";
import IpController, { ServiceLimit } from "../models/ipController";
import QueueControl from "../modules/queueControl";
import QueueController from "../models/queueController";
import LogController from "../modules/logController";
var url = require('url');
var express = require('express');
var bodyParser = require('body-parser'); 
var fs=require('fs')
var formidable= require('formidable') ;
const http = require('http');
var https = require('https');
var ips:Map<string,ServiceLimit>=new Map<string,ServiceLimit>();
var allService:ServiceLimit;
var byDomain:Map<string,ServiceLimit> ;
var byService:Map<string,ServiceLimit> ;
var haveIpcontroller:boolean;
export default class ExpressIndex
{
    sessionManager:SessionManager;
    config:EndpointConnection;
    server:any;
    logController:LogController;
    constructor(config:EndpointConnection )
    {
        this.config=config;
        this.logController=new LogController(config.logAddress,config.protocol.port)
    }
    checkIp(req,data)
    {
        if(!haveIpcontroller)return true;
        let now=new Date().getTime()
        var ip = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress  
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
    async stop()
    {
        if(this.server)
        {
            this.server.close()
        }
    }
    async init(ipController?:IpController,queueController?:QueueController)
    {
        var app = express();
        this.setPublic(app,this.config);
        this.setUrlParser(app,this.config);
        await this.setSessionManager(app,this.config);
        this.setCors(app,this.config);
        this.runServer(app,this.config);
        var self=this;
        let qcontrol:QueueControl;
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
        if(queueController)
        {
            qcontrol=new QueueControl(queueController);
        }
        let log =this.logController;
        app.use(async(req, res, next)=> { 
             
            
            var data = this.reqToDomain(req) 
            if(!data)
                return
			var session =req.session;
			if(!self.checkIp(req,data)) 
            {
                self.sendData(res,429 ,{message:ErrorMessages.tooManyRequests});
                return
            }
            let isAuthz = false;
            
            var route = Router.getRouteData(data.domain,data.service);
            if(!route)
            {
                return self.sendData(res,404,{message:ErrorMessages.notFound});
            }
            if(Array.isArray(route))
            {
                if(!route.filter(p=>p.method==req.method)[0])
                {
                    return self.sendData(res,404,{message:ErrorMessages.notFound});
                }
            }
            if(this.config.authz)
            { 
				try{
					isAuthz =await self.checkAuthz(session,data,self.config.authz);					
				}catch(exp)
				{
					console.log('exp>>',exp)
				}
            }
            else
            {
                isAuthz = Authorization.checkAuthorization(data.domain,data.service,session,req.method);
            }
            if(!isAuthz) 
                return self.sendData(res,403,{message:ErrorMessages.authz}) 

                
            if(qcontrol)
            {
                let checkQueue= qcontrol.check(data.domain,data.service,session)    
                if(!checkQueue)
                {
                    return self.sendData(res,403,{message:ErrorMessages.limit})  
                } 
            }
			var upload=await self.checkUpload(req,data,self)
			if(!upload)
				return self.sendData(res,413,{message:ErrorMessages.upload})
			try{
                let start=new Date().getTime()
                var responseData=await Router.runExternal(data.domain,data.service,new MessageModel(data.body),data.path,req.method,(data:RouteResponse,reject?:boolean)=>{
                    
                    if(data.response) 
                    { 
                        if(typeof(data.response.data)=='string' )
                        {
                            res.write(`${data.response.data}`); 
                        }
                        else
                        {
                            res.write(`${JSON.stringify(data.response.data)}`); 

                        } 
                        if(reject)
                        {
                            res.end()
                        }
                    }
                }); 
                log.addLog(data.domain,data.service,new Date().getTime()- start)
				var token= await this.setSession(req,responseData);
                var addedResponse=responseData?.addedResponse;
                if(addedResponse)
                {
                    if(responseData.addedResponse.stream) 
                    {
                        res.set( 'Content-Type', 'text/event-stream'  );
                        res.set( 'Cache-Control', 'no-cache'  );
                        res.set( 'Connection', 'keep-alive'  );
                        return 
                    }
                    if(responseData.addedResponse.redirect) 
                        return res.redirect(responseData.addedResponse.redirect) 
                    
                    if(responseData.addedResponse.directText)
                        return self.sendData(res,200,responseData.addedResponse.directText)

                    if(addedResponse.directFileDownload)
                    {
                        fs.readFile(addedResponse.directFileDownload,function(err, downloadData){ 
                            if(responseData.addedResponse.type)
                            {
                                res.set( 'Content-Type', responseData.addedResponse.type  );
                            }
                            return  self.sendData(res,200,downloadData)
                        })
                        return
                    } 
                }
                if(responseData.error)
                {
                    return self.sendData(res,500,responseData.error);
                } 

                var resp:any= responseData.response??{};       
                
				if(token)
					resp.token=token;
              return self.sendData(res,200,resp)
			}
			catch(exp)
			{
				console.log('exp>>',exp)
                return self.sendData(res,500,{message:exp})
			}
		});
    }
    
	async setSession(req,data:RouteResponse)
	{ 
		var token = req.header('authorization') 
		var sessionData=req.session;
        
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
	async getUploadFile(req,data:ExtrnalService):Promise<any>
	{
        return new Promise(async(res,rej)=>{    
			var form = new formidable.IncomingForm(); 
            if (data.maxUploadSize)
            {
                form.options.maxFileSize = data.maxUploadSize;
                form.options.maxFieldsSize = data.maxUploadSize;
            }
			form.parse(req, function (err,fields, files) {
				if(err )
					return  rej(err)
                var response=fields;
                for(var a in files)   
                { 
                    var fileData=files[a];
                    var file=new UploadFileModel({
                        path:fileData.filepath,
                        name:fileData.originalFilename,
                        size:fileData.size,
                        type:fileData.mimetype,
                    });
                    response[a]=file;
                } 
				res(response)
			});
		})
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
	async checkUpload(req,data,self:ExpressIndex)
	{
        let exist=Router.getRouteData(data.domain,data.service)
        var route:ExtrnalService;
        if(Array.isArray(exist))
        {
            route = exist.filter(p=>p.method==req.method)[0]
        }
        else
        {
            route =exist
        }
		if(route && route.maxUploadSize!=null)
		{ 
			try{ 
				data.body.data= await self.getUploadFile(req,route) 
			}
			catch(exp){ 
				console.log('exp>>',exp)
				return false;
			}
		}
		return true;
	}

    sendData(res,status,data)
    { 
        return res.status(status).send(data)
    }
	reqToDomain(req):{
        
        domain:string,
        service:string,
        path:string,
        body:any
    }
    {
        var url_parts = url.parse(req.url, true); 
        var seperate = url_parts.pathname.split('/')
        // if(!seperate || seperate.length!=3)
        // {
        //     self.sendData(res,200,{m:'endpoint001'})
        //     return
        // } 
        var session = req.session; 
        var body:any={
            session:session,
        }
        if(req.method=='GET')
        {
            body.data = {};
			for(var a in url_parts.query)
				body.data[a]=url_parts.query[a]
			
            if(req.body)
                for(var a in req.body){
                    body.data[a]=req.body[a] 
            }
        }
        else
        { 
            body.data=req.body 
            var bx = url_parts.query; 
            for(var a in bx)
            {
                body.data[a]=bx[a]
            } 
        } 
        var returnData:any={
            domain:seperate[1],
            service:seperate[2],
            path:url_parts.pathname,
            body
        } 
        return returnData
    }
	runServer(app,config:EndpointConnection)
    {
		var pr=config.protocol;
        let adresses=['127.0.0.1','localhost']
        if(config.bindAddress)
        {
            if(Array.isArray(config.bindAddress))
            {
                adresses=config.bindAddress
            }
            else
            {
                adresses=[config.bindAddress]
            }
        }
        if(pr.type=="http")
        { 
            var server = http.createServer(app);

            server.listen(pr.port,adresses);
            this.server=server;
            console.log("\x1b[32m%s\x1b[0m",'http run at port '+ pr.port);
        }
        if(pr.type=="https")
        { 
            var privateKey  = fs.readFileSync(pr.key, 'utf8');
            var certificate = fs.readFileSync(pr.crt, 'utf8');
            var credentials = {key: privateKey, cert: certificate};
            var server = https.createServer(credentials,app);
            server.listen(pr.port,adresses);
            this.server=server;
            console.log("\x1b[32m%s\x1b[0m",'http run at port '+ pr.port);
        }
    }
	setUrlParser(app,config:EndpointConnection)
    {
        
        if(config.limit?.bodyLimit)
            app.use(bodyParser.json({limit: config.limit.bodyLimit*1026*1024}));
        else    
            app.use(bodyParser.json());
            
        if(config.limit?.urlLimit)
            app.use(bodyParser.urlencoded({limit: config.limit.urlLimit*1026*1024,extended: true}));
        else 
            app.use(bodyParser.urlencoded({extended: true}));
    
    }
    async setSessionManager(app,config:EndpointConnection)
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
		app.use( (req, res, next)=>{
            var token = req.header('authorization')
            this.sessionManager.getSession(token).then((data)=>{ 
				req.session=data;
				next();
			}).catch(()=>{
				next()
			});
		})
    }
	setPublic(app:any,config:EndpointConnection)
    { 
        for(var folder of config.publicFolder)
        {
            app.use(express.static(folder));
        }
    }
	setCors(app:any,config:EndpointConnection)
    {
        if(!config.cors)return;
        if(config.cors.indexOf('*')>-1)
        {
            app.use(function (req, res, next) {  
                console.log(req.headers.origin);
                
                if ('OPTIONS' == req.method) {
                    res.header('Access-Control-Allow-Origin', req.headers.origin); 
                    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
                    res.header('Access-Control-Allow-Headers',
                    config.allowHeader?? 'Content-Type, Authorization, Content-Length, X-Requested-With');
                    res.setHeader('Access-Control-Allow-Credentials', true);
                    res.status(200).send('OK');
                }
                else
                {
                    res.header('Access-Control-Allow-Origin', req.headers.origin); 
                    res.setHeader('Access-Control-Allow-Credentials', true);
                    next()
                }
            });

        }
        else
        {
            let corsMap:Map<string,boolean>=new Map<string,boolean>();
            for(let c of config.cors)
            {
                corsMap.set(c,true);
            }
            app.use(function (req, res, next) { 
                res.setHeader('Access-Control-Allow-Credentials', true);
                if ('OPTIONS' == req.method) { 
                    if(corsMap.has(req.headers.origin))
                    {
                        res.header('Access-Control-Allow-Origin', req.headers.origin);
                    }
                    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
                    res.header('Access-Control-Allow-Headers', config.allowHeader??'Content-Type, Authorization, Content-Length, X-Requested-With');
                    res.status(200).send('OK');
                }
                else
                {
                    if(corsMap.has(req.headers.origin))
                    {
                        res.header('Access-Control-Allow-Origin', req.headers.origin);
                    } 
                    next()
                }
    
            });
        } 
    }
}