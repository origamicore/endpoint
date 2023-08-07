import { ExtrnalService, Router } from "@origamicore/core";

export default class Authorization
{
    static checkAuthorization(domain:string,service:string,session:any,method:string):boolean
    { 
        if(session && session.superadmin) return true;
        let find=Router.getRouteData(domain,service);
        var route:ExtrnalService ; 
        if(Array.isArray(find))
        {
            route=find.filter(p=>p.method==method)[0]
        }
        else
        {
            route=find;
        }
        if(route.isPublic)return true;
        if(!session?.userid) return false;
        if(route.roles)
        {
            if(!session.role) return false;
            return  route.roles?.indexOf(session.role)>-1;
        }
        return true;
    }
}