export default class LogModel
{ 
    server:string
    fromTime:number
    toTime:number
    port:number
    domain:string
    service:string
    minRequestDelay:number=0;
    maxRequestDelay:number=0;
    sumRequestDelay:number=0; 
    requestCount:number=0;
    constructor(data:any)
    {
        Object.assign(this,data); 
    }
}