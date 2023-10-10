import {ModuleConfig, PackageIndex} from '@origamicore/core' 
import EndpointConfig from './models/endpointConfig';
import { EndpointConnectionType } from './models/endpointConnection';
import ExpressIndex from './services/expressIndex';
import SocketIndex from './services/socketIndex';
export default class TsOriEndpoint implements PackageIndex
{
    name: string='endpoint';
    private config:EndpointConfig;
    private expressList:ExpressIndex[]=[];
    private socketList:SocketIndex[]=[];
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