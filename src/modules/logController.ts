import { WebService } from "@origamicore/base";
import LogModel from "../models/logModel";

export default class LogController
{
    port:number;
    address:string;
    valid:boolean;
    loglist:LogModel[]=[]
    logs:Map<string,LogModel>=new Map<string,LogModel>()
    start:number;
    end:number;
    work:boolean=false
    constructor(address:string,port:number)
    {
        this.port=port;
        this.address=address
        this.valid=!!address
        if(!this.valid)return;
        let delay=5000
        setInterval(()=>{
            let now=new Date().getTime()
            this.start=now- now %(delay)
            this.end=this.start+delay;
            this.logs.forEach((value: LogModel ) => {
                this.loglist.push(value)
            })
            this.logs.clear()
            this.syncToServer()
        },delay)
    }
    async syncToServer()
    {
        if(this.work)return;
        this.work=true;
        while(this.loglist.length)
        {
            let log=this.loglist[0];
            try{
                let x= await WebService.post(this.address+'/api/addEndpointLog',{endpoint:log},null,null);
                this.loglist.splice(0,1)

            }catch(exp){
                await new Promise((res)=>{
                    setTimeout(()=>{
                        res({})
                    },400)
                })
            }
        } 
        this.work=false;
    }
    addLog(domain:string,service:string,time:number)
    {
        if(!this.valid)return;
        let key=domain+service;
        let log=this.logs.get(key);
        if(!log)
        {
            log=new LogModel({domain,service,fromTime:this.start,toTime:this.end,minRequestDelay:time,maxRequestDelay:time,port:this.port});
            this.logs.set(key,log);
        }
        log.requestCount++;
        if(time>log.maxRequestDelay)log.maxRequestDelay=time;
        if(time<log.minRequestDelay)log.minRequestDelay=time;
        log.sumRequestDelay+=time; 
    }
}