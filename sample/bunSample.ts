import OrigamiCore, { ConfigModel } from '@origamicore/core'  
import EndpointConfig from '../src/models/endpointConfig';
import EndpointConnection, { EndpointConnectionType } from '../src/models/endpointConnection';
import ConnectionProtocol from '../src/models/connectionProtocol';
import ProfileConfig from './profileService/models/profileConfig';
var path = require('path');  
export default class EndpointSample
{
    constructor()
    {
        this.init();
    }
    async init()
    { 
        var origamicore = new OrigamiCore(new ConfigModel({
            packageConfig:[
                new EndpointConfig({
                    connections:[
                        new EndpointConnection({
                            type:EndpointConnectionType.Bun, 
                            protocol:new ConnectionProtocol({
                                type:'http',
                                port:9201, 
                                // crt:path.join(__dirname,'../sample/crt.pem'),
                                // key:path.join(__dirname,'../sample/key.pem')
                            }), 
                            publicFolder:[path.join(__dirname,'../sample/public')]
                        }),

                    ]
                }),
                new ProfileConfig({ 
                    readOnley:false
                }) 
            ]
        }));
        await origamicore.start( )   
    }
}

new EndpointSample()