/* 从已确认的 PNG 实时取样轮廓与内部纹理；不重新生成角色。 */
(()=>{'use strict';const canvas=document.getElementById('silhouette'),stage=canvas.parentElement;
const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});
window.motionState={paused:matchMedia('(prefers-reduced-motion: reduce)').matches,hidden:false};
if(!gl){stage.classList.add('no-webgl');return;}
const vs='attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
const fs=`precision mediump float;varying vec2 v;uniform sampler2D tex;uniform vec2 res;uniform float time,paper,still,bodyTime,bodyAmount;uniform vec4 box,portraitClip;uniform vec3 mouse;uniform vec2 velocity;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
// Rigid inverse transforms in source-pixel aspect, not spatially varying UV rotations.
float source(vec2 p){if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 0.;return texture2D(tex,p).r;}
vec2 turn(vec2 p,vec2 pivot,float a){vec2 d=(p-pivot)*vec2(1.5,1.);float c=cos(a),s=sin(a);return pivot+mat2(c,-s,s,c)*d/vec2(1.5,1.);}
// Rigid source regions overlap only at the shoulder attachment; no UV stretching.
float beat(float phase){return sin(phase)+.16*sin(2.*phase-.4);}
float leftPart(vec2 p,float offset){float boundary=.49-.32*(p.y-.34)+offset;return (1.-smoothstep(boundary-.005,boundary+.005,p.x))*smoothstep(.29,.34,p.y)*(1.-smoothstep(.78,.81,p.y));}
float rightPart(vec2 p,float offset){float bottom=.365+.18*(p.x-.70);return smoothstep(.695+offset,.715+offset,p.x)*(1.-smoothstep(bottom-.008,bottom+.008,p.y));}
float lum(vec2 p){float phase=bodyTime*1.309;float gain=bodyAmount;
vec2 q=turn(p,vec2(.62,.65),gain*.028*beat(phase));
vec2 l=turn(q,vec2(.48,.355),gain*.19*beat(phase+.25));
vec2 r=turn(q,vec2(.705,.285),-gain*.19*beat(phase+.9));
float body=source(q)*(1.-leftPart(q,.004))*(1.-rightPart(q,-.012));
body=max(body,source(q)*(1.-smoothstep(.025,.05,length((q-vec2(.48,.355))*vec2(1.5,1.)))));
body=max(body,source(q)*(1.-smoothstep(.025,.05,length((q-vec2(.705,.285))*vec2(1.5,1.)))));
float limbs=max(source(l)*leftPart(l,.004),source(r)*rightPart(r,-.012));
return max(body,limbs);}
void main(){vec2 screen=vec2(v.x,1.-v.y);vec2 uv=(screen-box.xy)/box.zw;

float near=exp(-18.*length((screen-mouse.xy)*vec2(res.x/res.y,1.)))*mouse.z;
uv-=velocity*.003*near*(1.-still);float t=time;vec2 drift=vec2(noise(uv*7.+t*.13),noise(uv*9.-t*.11))-.5;
uv+=drift*.003*(1.-still)*(1.+near*4.);
float raw=lum(uv);vec2 px=vec2(1./1536.,1./1024.);float center=(raw+lum(uv+px*vec2(3.,0.))+lum(uv-px*vec2(3.,0.))+lum(uv+px*vec2(0.,3.))+lum(uv-px*vec2(0.,3.)))/5.;
float gx=abs(lum(uv+px*vec2(5.,0.))-lum(uv-px*vec2(5.,0.)));float gy=abs(lum(uv+px*vec2(0.,5.))-lum(uv-px*vec2(0.,5.)));float edge=smoothstep(.18,.75,gx+gy);
float wave=.5+.5*sin(t*.60+.35*sin(t*.27));float outline=smoothstep(.68,.92,wave)*(1.-still);
float field=noise(uv*vec2(13.,9.)+vec2(t*.16,-t*.12));float gate=smoothstep(.43,.50,field+.10*sin(t*.73+uv.y*8.));float patches=smoothstep(.27,.60,wave);
float interior=raw*mix(mix(.94,.10+.84*gate,patches),.89,still)*(1.-outline*.98);
float edgeGate=smoothstep(.30,.68,noise(uv*45.+vec2(-t*.9,t*.35)));float line=edge*edgeGate*(.22+outline*.66);
float ink=mix(clamp(interior+line,0.,1.),raw,still);float grain=hash(floor(gl_FragCoord.xy*.7)+floor(t*7.));ink*=mix(mix(.85,1.,grain),1.,still);
float clipMask=smoothstep(portraitClip.x,portraitClip.x+.025,screen.x)*(1.-smoothstep(portraitClip.z-.035,portraitClip.z,screen.x))*smoothstep(portraitClip.y,portraitClip.y+.008,screen.y)*(1.-smoothstep(portraitClip.w-max(.045,(portraitClip.w-portraitClip.y)*.22),portraitClip.w,screen.y));ink*=mix(1.,clipMask*(1.-smoothstep(.80,1.,uv.y)),paper);
vec3 bg=mix(vec3(.026),vec3(.937,.933,.912),paper);vec3 fg=mix(vec3(.93,.926,.9),vec3(.10,.10,.095),paper);gl_FragColor=vec4(mix(bg,fg,ink),1.);
}`;
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
let program;try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader link failed');}catch(e){console.warn('剪影采用静态后备',e);canvas.style.display='none';stage.classList.add('no-webgl');return;}
gl.useProgram(program);let buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);let loc=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
const U={};['res','time','bodyTime','bodyAmount','paper','still','box','portraitClip','mouse','velocity'].forEach(k=>U[k]=gl.getUniformLocation(program,k));const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const image=new Image();image.src='assets/silhouette.png';let ready=false;image.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);ready=true;};
let pointer=[.65,.45,0],vel=[0,0],previous=[.65,.45],lastFrame=0,clock=0;
window.addEventListener('pointermove',e=>{if(window.motionState.paused)return;let x=e.clientX/innerWidth,y=e.clientY/innerHeight;vel=[Math.max(-1,Math.min(1,(x-previous[0])*20)),Math.max(-1,Math.min(1,(y-previous[1])*20))];previous=[x,y];pointer=[x,y,1];},{passive:true});
const clamp=x=>Math.max(0,Math.min(1,x));const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};const mix=(a,b,t)=>a+(b-a)*t;
function draw(now){requestAnimationFrame(draw);if(!ready||document.hidden||window.motionState.hidden){lastFrame=now;return;}const dt=Math.min((now-lastFrame)/1000,.08);lastFrame=now;if(!window.motionState.paused)clock+=dt;if(new URLSearchParams(location.search).has('motion-capture')&&Number.isFinite(window.__captureTime))clock=window.__captureTime;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ratio=Math.min(devicePixelRatio||1,1);if(canvas.width!==Math.round(innerWidth*ratio)||canvas.height!==Math.round(innerHeight*ratio)){canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);gl.viewport(0,0,canvas.width,canvas.height);}
const about=document.getElementById('about').getBoundingClientRect(),work=document.getElementById('work').getBoundingClientRect();let enter=smooth((innerHeight*.85-about.top)/(innerHeight*.7));let exit=smooth((innerHeight*.75-work.top)/(innerHeight*.65));let p=enter*(1-exit);let mobile=innerWidth<600;
const pr=document.querySelector('.portrait-space').getBoundingClientRect();
const aw=pr.width*(innerWidth<=740?1.48:1.60)/innerWidth,ah=aw*innerWidth/1.5/innerHeight;
let w=mix(mobile?1.9:1.02,aw,p),h=w*innerWidth/1.5/innerHeight;
let x=mix(mobile?-.4:.06,(pr.left-pr.width*(innerWidth<=740?.40:.43))/innerWidth,p),y=mix(mobile?.25:.05,pr.top/innerHeight,p);
gl.uniform4f(U.portraitClip,pr.left/innerWidth,pr.top/innerHeight,Math.min(innerWidth-12,pr.right+innerWidth*.025)/innerWidth,pr.bottom/innerHeight);

gl.uniform2f(U.res,canvas.width,canvas.height);gl.uniform1f(U.time,new URLSearchParams(location.search).has('pose-check')?0:clock);gl.uniform1f(U.bodyTime,clock);gl.uniform1f(U.bodyAmount,reduced?0:(mobile?.55:1)*mix(1,.6,p));gl.uniform1f(U.paper,p);gl.uniform1f(U.still,reduced||new URLSearchParams(location.search).has('pose-check')?1:0);gl.uniform4f(U.box,x,y,w,h);gl.uniform3fv(U.mouse,pointer);gl.uniform2fv(U.velocity,vel);gl.drawArrays(gl.TRIANGLES,0,6);
if(!window.motionState.paused){pointer[2]*=Math.exp(-3*dt);vel[0]*=Math.exp(-5*dt);vel[1]*=Math.exp(-5*dt);}document.documentElement.style.setProperty('--scene-paper',p);}
requestAnimationFrame(draw);
canvas.addEventListener('webglcontextlost',()=>{canvas.style.display='none';stage.classList.add('no-webgl');});
})();
