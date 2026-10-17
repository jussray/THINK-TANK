import {createRemoteJWKSet,jwtVerify} from 'jose';

const jwks = new Map();
export async function verifyFounderAccess(request,env){
  const domain=env.ACCESS_TEAM_DOMAIN;
  const audience=env.ACCESS_AUD;
  if(!domain || !/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(domain) ||
     !audience || !/^[a-f0-9]{64}$/i.test(audience)){
    const error=new Error('ACCESS_NOT_CONFIGURED');error.status=503;throw error;
  }
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token){const error=new Error('UNAUTHORIZED');error.status=401;throw error;}
  const issuer='https://'+domain;
  let set=jwks.get(issuer);
  if(!set){set=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));jwks.set(issuer,set);}
  try {
    const {payload}=await jwtVerify(token,set,{audience,issuer,algorithms:['RS256']});
    if(typeof payload.sub!=='string'||!payload.sub.trim())throw Error('MISSING_SUB');
    return payload.sub;
  }catch {
    const error=new Error('UNAUTHORIZED');error.status=401;throw error;
  }
}
