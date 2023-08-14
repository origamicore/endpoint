import JwtConfig from "./jwtConfig";
import RedisConfig from "./redisConfig";

export default class ConnectionProtocol
{
    type:'http'|'https'='http';
    port:number;
    key:string;
    crt:string; 
    socketProtocol:string='echo-protocol';
    jwtConfig:JwtConfig;
    redisConfig:RedisConfig;

    public constructor(
        data?: {
            port: number  
            type?: 'http'|'https'
            key?: string  
            crt?: string
            socketProtocol?: string
            jwtConfig?:JwtConfig
            redisConfig?:RedisConfig
        }) {
        if (data) {
            if(data.port)this.port=data.port;
            if(data.type)this.type=data.type;
            if(data.key)this.key=data.key;
            if(data.crt)this.crt=data.crt;
            if(data.socketProtocol)this.socketProtocol=data.socketProtocol;
            if(data.jwtConfig)this.jwtConfig=data.jwtConfig;
            if(data.redisConfig)this.redisConfig=data.redisConfig;
        }
    }
}