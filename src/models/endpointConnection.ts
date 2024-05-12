import AuthzEndpoint from "./authzEndpoint";
import ConnectionProtocol from "./connectionProtocol";
import LimitModel from "./limitModel";
import ConnectionEvent from "./socket/connectionEvent";

export class EndpointConnectionType
{
    static Socket='socket';
    static Express='express';
    static Bun='bun';
}
export default class EndpointConnection
{ 
    name:string;
    bindAddress:string|[];
    type:EndpointConnectionType=EndpointConnectionType.Express;
    sessionManager:string;
    allowHeader:string;
    publicFolder:string[]=[];
    cors:string[]=[];
    limit:LimitModel;
    authz:AuthzEndpoint;
    protocol:ConnectionProtocol;
    debug:boolean
    events:ConnectionEvent[]=[];
    logAddress:string;
    public constructor(
        data: {
            protocol:ConnectionProtocol
            type?: EndpointConnectionType;
            name?: string; 
            bindAddress?: string|[]; 
            sessionManager?: string; 
            publicFolder?: string[]; 
            cors?: string[];
            allowHeader?: string; 
            authz?:AuthzEndpoint;
            limit?:LimitModel;
            debug?:boolean;
            events?:ConnectionEvent[];
            logAddress?:string;
        }) {
        if (data) {
            if(data.protocol)this.protocol=data.protocol;
            if(data.type)this.type=data.type;
            if(data.name)this.name=data.name;
            if(data.bindAddress)this.bindAddress=data.bindAddress;
            if(data.sessionManager)this.sessionManager=data.sessionManager;
            if(data.publicFolder)this.publicFolder=data.publicFolder;
            if(data.cors)this.cors=data.cors;
            if(data.allowHeader)this.allowHeader=data.allowHeader;
            if(data.authz)this.authz=data.authz;
            if(data.limit)this.limit=data.limit;
            if(data.debug)this.debug=data.debug;
            if(data.events)this.events=data.events;
            if(data.logAddress)this.logAddress=data.logAddress;
        }
    }
}