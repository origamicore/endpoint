import { OriProps,IOriModel, OriModel } from "@origamicore/core"; 

@OriModel()
export default class ProfileModel extends IOriModel
{
    @OriProps({isRequired:true})
    firstName:string;
    @OriProps({})
    lastName:string;
    constructor(
        fields?: {
            firstName?: string
            lastName?: string
        })
    {
        super();  
        if (fields) 
        {
            Object.assign(this, fields); 
        }
    }
}