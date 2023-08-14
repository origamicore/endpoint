 
  
import {ModuleConfig, PackageIndex} from '@origamicore/core';
import TsOriEndpoint from '..';
import EndpointConnection from './endpointConnection';
import IpController from './ipController';
import QueueController from './queueController';
import ConnectionProtocol from './connectionProtocol';
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
        }|number
        ) {
            if(typeof fields=='number')
            {
                super({});
                this.connections=[
                    new EndpointConnection({
                        protocol:new ConnectionProtocol({
                            port:fields
                        })
                    })
                ]
            }
            else
            {
                super(fields);
                if (fields) Object.assign(this, fields);
            }
    }
}