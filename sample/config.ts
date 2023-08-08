
import {ConfigModel,HttpMethod} from "@origamicore/core";
import {ConnectionProtocol,EndpointConfig,EndpointConnection,EndpointConnectionType, IpController, QueueController, QueueLimit, ServiceLimit} from "..";  
import ProfileConfig from "./profileService/models/profileConfig";
import ConnectionEvent, { ConnectionEventType } from "../src/models/socket/connectionEvent";
import fs from 'fs'
var path = require('path');  
export default new ConfigModel({
    defaultMethod:HttpMethod.None,
    packageConfig:[
         new EndpointConfig({  
             queue:new QueueController({
                limits:[
                    new QueueLimit({
                        delayPerSec:5,
                        domain:'profile',
                        services:['queueTest']
                    })
                ]
             })
             ,
            ipController:new IpController({
                limits:[
                    new ServiceLimit({ 
                        domain:'profile',
                        service:'login',
                        count:3,
                        delayPerSec:30,

                    }),
                    new ServiceLimit({ 
                        domain:'profile', 
                        count:10,
                        delayPerSec:50,

                    }),
                ]
            }),
             connections:[
                 new EndpointConnection({
                     type:EndpointConnectionType.Express,
                     publicFolder:[path.join(__dirname,'../../sample/public')],
                     protocol:new ConnectionProtocol({
                         type:'https',
                         port:9201,
                         crt: path.join(__dirname,'../../sample/crt.pem') ,
                         key: path.join(__dirname,'../../sample/key.pem') ,
                     }),
                     cors:['https://sample1.local:9201']
                 }),
                 
                 new EndpointConnection({
                    type:EndpointConnectionType.Express,
                    publicFolder:[path.join(__dirname,'../../sample/public')],
                    protocol:new ConnectionProtocol({
                        type:'http',
                        port:9203 
                    }),
                    cors:['http://sample1.local:9201'],
                    bindAddress:'sample1.local'
                }),
                 new EndpointConnection({
                    type:EndpointConnectionType.Soucket,
                    protocol:new ConnectionProtocol({
                        type:'http',
                        port:9202
                    }),
                    events:[
                        new ConnectionEvent({
                            domain:'profile',
                            service:'openSession',
                            type:ConnectionEventType.Open
                        }),
                        new ConnectionEvent({
                            domain:'profile',
                            service:'closeSession',
                            type:ConnectionEventType.Close
                        }),
                    ]
                })
             ]
         }),
        new ProfileConfig({ 
            readOnley:false
        }) 
    ]
});