import {ModuleConfig, PackageIndex} from '@origamicore/core' 
import EndpointConfig from './models/endpointConfig';
import { EndpointConnectionType } from './models/endpointConnection';
import ExpressIndex from './services/expressIndex';
import SocketIndex from './services/socketIndex';
import BunIndex from './services/bunIndex';
export default class TsOriEndpoint implements PackageIndex
{
    name: string='endpoint';
    private config:EndpointConfig;
    private expressList:ExpressIndex[]=[];
    private socketList:SocketIndex[]=[];
    private bunList:BunIndex[]=[];
    jsonConfig(config: EndpointConfig): Promise<void> {
         this.config=config ;
         this.socketList=[]
         this.expressList=[]
        for(var connection of this.config.connections )
        {
            if(connection.type==EndpointConnectionType.Socket)
            {
                this.socketList.push(new SocketIndex(connection))
            }
            else if(connection.type==EndpointConnectionType.Bun)
            {

                this.bunList.push(new BunIndex(connection))
            }
            else
            {
                this.expressList.push( new ExpressIndex(connection)) ; 
            }
        }
        return;
    }
    async start(): Promise<void> { 

        for(var express of this.expressList)
        {
            await express.init(this.config.ipController,this.config.queue);
        }
        for(var socket of this.socketList)
        {
            await socket.init()
        } 
        for(var bun of this.bunList)
        {
            await bun.init(this.config.ipController,this.config.queue)
        } 
    }
    async restart(): Promise<void> {
        for(var express of this.expressList)
        {
            await express.stop();
        }
        for(var socket of this.socketList)
        {
            await socket.stop()
        } 
    }
    async stop(): Promise<void> {
        for(var express of this.expressList)
        {
            await express.stop();
        }
        for(var socket of this.socketList)
        {
            await socket.stop()
        } 
    }

}