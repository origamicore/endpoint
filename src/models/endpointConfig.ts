 
  
import {ModuleConfig, PackageIndex} from '@origamicore/core';
import TsOriEndpoint from '..';
import EndpointConnection, { EndpointConnectionType } from './endpointConnection';
import IpController from './ipController';
import QueueController from './queueController';
import ConnectionProtocol from './connectionProtocol';
import JwtConfig from './jwtConfig';
import RedisConfig from './redisConfig';
import AuthzEndpoint from './authzEndpoint';
import LimitModel from './limitModel';
import ConnectionEvent from './socket/connectionEvent';
export default class EndpointConfig extends ModuleConfig
{
    async createInstance(): Promise<PackageIndex> {
        var instance = new TsOriEndpoint();
        await instance.jsonConfig(this);
        return instance;
    } 
    connections:EndpointConnection[];
    ipController:IpController;
    queue:QueueController;
    public constructor( 
        fields: {
            id?: string 
            connections: EndpointConnection[]
            ipController?:IpController;
            queue?:QueueController;
        } 
        ) { 
        super(fields);
        if (fields) Object.assign(this, fields);
    }
    public static create(
        data:{
            port: number  
            protocolType?: 'http'|'https'
            key?: string  
            crt?: string
            socketProtocol?: string
            sessionConfig?:JwtConfig|RedisConfig 
            
            type?: EndpointConnectionType, 
            bindAddress?: string|[], 
            sessionManager?: string, 
            publicFolder?: string[], 
            cors?: string[], 
            allowHeader?: string, 
            authz?:AuthzEndpoint,
            limit?:LimitModel,
            debug?:boolean,
            events?:ConnectionEvent[]
        }
    )
    { 
        let config=new EndpointConfig({
            connections:[
                new EndpointConnection({
                    protocol:new ConnectionProtocol({
                        port:data.port,
                        crt:data.crt,
                        key:data.key,
                        socketProtocol:data.socketProtocol,
                        type:data.protocolType,
                        jwtConfig:(data.sessionConfig instanceof JwtConfig) ? data.sessionConfig :null,
                        redisConfig:(data.sessionConfig instanceof RedisConfig) ? data.sessionConfig :null,
                    }),
                    allowHeader:data.allowHeader,
                    authz:data.authz,
                    bindAddress:data.bindAddress,
                    cors:data.cors,
                    debug:data.debug,
                    events:data.events,
                    limit:data.limit,
                    publicFolder:data.publicFolder,
                    sessionManager:data.sessionManager,
                    type:data.type
                }),

            ]
        });
        return config
    }
}