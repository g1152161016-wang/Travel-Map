/* Travel Map city-scale raster tile map engine.
 * No map framework/CDN or paid API key is required for the base map.
 * Detailed streets and labels are loaded from Esri public raster basemap services.
 */
(function(){
  "use strict";
  const TILE=256, MIN_Z=2, MAX_Z=19;
  const providers=[
    {name:"Esri World Street Map",url:(z,x,y)=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`,attr:'Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCAN, Esri Japan, METI, Esri China (Hong Kong), NOSTRA, © OpenStreetMap contributors, and the GIS User Community'},
    {name:"Esri World Topographic Map",url:(z,x,y)=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,attr:'Sources: Esri, Garmin, USGS, NOAA, © OpenStreetMap contributors, and the GIS User Community'}
  ];
  const colors={visited:"#71836a",wishlist:"#c18b69",planning:"#8a91a0"};
  let root,tiles,markers,callback,moveCallback,center={lat:20,lng:0},zoom=2,drag=null,pinDrag=null,providerIndex=0,failed=0,activePopup=null,resizeObserver;
  let width=0,height=0,renderQueued=false;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function project(lat,lng,z=zoom){const scale=TILE*Math.pow(2,z),s=Math.sin(clamp(lat,-85.05112878,85.05112878)*Math.PI/180);return{x:(lng+180)/360*scale,y:(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*scale};}
  function unproject(x,y,z=zoom){const scale=TILE*Math.pow(2,z),lng=x/scale*360-180,n=Math.PI-2*Math.PI*y/scale,lat=180/Math.PI*Math.atan(Math.sinh(n));return{lat,lng};}
  function safe(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function schedule(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;draw();});}
  function showMessage(html){let n=root.querySelector('.map-message');if(!n){n=document.createElement('div');n.className='map-message';root.appendChild(n);}n.innerHTML=html;}
  function hideMessage(){root.querySelector('.map-message')?.remove();}
  function tileFailed(){failed++;if(failed>=Math.min(3,Math.max(1,tiles.querySelectorAll('img').length))&&providerIndex===0){providerIndex=1;failed=0;draw();return;}if(failed>=5){showMessage('地圖服務目前無法連線。已嘗試 Esri 街道圖及地形圖兩種來源；請確認網路或瀏覽器沒有封鎖 server.arcgisonline.com。你的旅遊標記與紀錄仍會保留。');}}
  function draw(){if(!root||!tiles)return;width=root.clientWidth;height=root.clientHeight;if(!width||!height)return;root.querySelector(".map-popup-card")?.remove();activePopup=null;tiles.replaceChildren();markers.replaceChildren();
    const c=project(center.lat,center.lng),left=c.x-width/2,top=c.y-height/2;
    const x0=Math.floor(left/TILE),y0=Math.floor(top/TILE),x1=Math.floor((left+width)/TILE),y1=Math.floor((top+height)/TILE),n=Math.pow(2,zoom);
    failed=0;let count=0;
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){if(ty<0||ty>=n)continue;const wrapped=((tx%n)+n)%n,img=document.createElement('img');img.className='map-tile';img.alt='';img.draggable=false;img.style.left=(tx*TILE-left)+'px';img.style.top=(ty*TILE-top)+'px';img.src=providers[providerIndex].url(zoom,wrapped,ty);img.onerror=()=>{img.remove();tileFailed();};img.onload=()=>{hideMessage();};tiles.appendChild(img);count++;}
    root.querySelector('.map-attribution').innerHTML=providers[providerIndex].attr;
    root.querySelector('.map-zoom-level').textContent=`${zoom} 級`;
    window.__travelMapViewport={left,top,width,height,zoom};
    renderMarkers(window.__travelMapItems||[]);
    if(!count)showMessage('目前視野超出可顯示範圍，請縮小地圖。');
  }
  function renderMarkers(items){
    if(!markers)return;
    const c=project(center.lat,center.lng),left=c.x-width/2,top=c.y-height/2;
    (items||[]).forEach(item=>{
      const lat=Number(item.lat),lng=Number(item.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;
      const p=project(lat,lng),x=p.x-left,y=p.y-top;
      if(x < -50||x>width+50||y < -60||y>height+60)return;
      const b=document.createElement('button');
      b.type='button';b.className=`travel-pin ${item.status||'wishlist'}`;
      b.style.left=x+'px';b.style.top=y+'px';
      b.innerHTML=`<span>${item.status==='visited'?'✓':item.status==='planning'?'✧':'♡'}</span>`;
      b.title=[item.name,item.city,item.country].filter(Boolean).join(' · ')+'（可拖曳調整位置）';
      b.setAttribute('aria-label',`旅遊標記：${item.name}，可拖曳調整位置`);
      b.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        e.preventDefault();e.stopPropagation();
        pinDrag={id:item.id,button:b,startX:e.clientX,startY:e.clientY,x,y,moved:false};
        b.setPointerCapture?.(e.pointerId);
      });
      b.addEventListener('pointermove',e=>{
        if(!pinDrag||pinDrag.id!==item.id)return;
        const dx=e.clientX-pinDrag.startX,dy=e.clientY-pinDrag.startY;
        if(Math.abs(dx)+Math.abs(dy)>3)pinDrag.moved=true;
        if(pinDrag.moved){b.style.left=(pinDrag.x+dx)+'px';b.style.top=(pinDrag.y+dy)+'px';}
      });
      b.addEventListener('pointerup',e=>{
        if(!pinDrag||pinDrag.id!==item.id)return;
        const state=pinDrag;pinDrag=null;
        if(state.moved){
          const px=state.x+(e.clientX-state.startX),py=state.y+(e.clientY-state.startY);
          const mapCenter=project(center.lat,center.lng);
          const geo=unproject(mapCenter.x-width/2+px,mapCenter.y-height/2+py);
          root.querySelector('.map-popup-card')?.remove();activePopup=null;
          if(typeof moveCallback==='function')moveCallback(item.id,geo.lat,geo.lng);
        }else{
          showPopup(item,x,y);
        }
      });
      b.addEventListener('pointercancel',()=>{if(pinDrag?.id===item.id)pinDrag=null;schedule();});
      markers.appendChild(b);
    });
  }
  function showPopup(item,x,y){root.querySelector('.map-popup-card')?.remove();const p=document.createElement('div');p.className='map-popup-card';p.style.left=clamp(x+12,8,width-245)+'px';p.style.top=clamp(y-75,8,height-85)+'px';const status={visited:'去過',wishlist:'想去',planning:'計畫中'}[item.status]||'想去';p.innerHTML=`<strong>${safe(item.name)}</strong><span>${safe([item.city,item.country].filter(Boolean).join(' · '))}｜${status}</span>`;root.appendChild(p);activePopup=p;}
  function setCenter(lat,lng,z=zoom){center={lat:clamp(Number(lat),-85,85),lng:Number(lng)};zoom=clamp(Math.round(z),MIN_Z,MAX_Z);schedule();}
  function zoomAt(next,px=width/2,py=height/2){const old=project(center.lat,center.lng),worldX=old.x-width/2+px,worldY=old.y-height/2+py,geo=unproject(worldX,worldY);zoom=clamp(next,MIN_Z,MAX_Z);const p=project(geo.lat,geo.lng);center=unproject(p.x-(px-width/2),p.y-(py-height/2));schedule();}
  function init(onPick,onMove){callback=onPick;moveCallback=onMove;root=document.getElementById('map');if(!root)return;root.innerHTML='<div class="tile-layer"></div><div class="marker-layer"></div><div class="tile-map-controls"><button type="button" aria-label="放大地圖">＋</button><button type="button" aria-label="縮小地圖">−</button></div><div class="map-attribution"></div><div class="map-zoom-level" aria-live="polite"></div>';
    root.classList.add('city-map');tiles=root.querySelector('.tile-layer');markers=root.querySelector('.marker-layer');
    const ctr=root.querySelectorAll('.tile-map-controls button');ctr[0].addEventListener('click',()=>zoomAt(zoom+1));ctr[1].addEventListener('click',()=>zoomAt(zoom-1));
    root.addEventListener('wheel',e=>{root.querySelector('.map-popup-card')?.remove();activePopup=null;e.preventDefault();const r=root.getBoundingClientRect();zoomAt(zoom+(e.deltaY<0?1:-1),e.clientX-r.left,e.clientY-r.top);},{passive:false});
    root.addEventListener('pointerdown',e=>{if(e.target.closest('button')||e.target.closest('a'))return;root.querySelector('.map-popup-card')?.remove();activePopup=null;drag={x:e.clientX,y:e.clientY,center:{...center},moved:false};root.setPointerCapture(e.pointerId);});
    root.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.moved=true;const c=project(drag.center.lat,drag.center.lng);center=unproject(c.x-dx,c.y-dy);schedule();});
    root.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;if(!d.moved){const r=root.getBoundingClientRect(),c=project(center.lat,center.lng),geo=unproject(c.x-width/2+e.clientX-r.left,c.y-height/2+e.clientY-r.top);if(typeof callback==='function')callback(geo.lat,geo.lng);} });
    root.addEventListener('pointercancel',()=>drag=null);
    resizeObserver=new ResizeObserver(schedule);resizeObserver.observe(root);
    window.addEventListener('resize',schedule,{passive:true});
    schedule();
  }
  function render(items){window.__travelMapItems=items||[];schedule();}
  function focus(id){const item=(window.__travelMapItems||[]).find(d=>d.id===id);if(!item)return;setCenter(item.lat,item.lng,Math.max(zoom,14));}
  function focusCoords(lat,lng,z=15){setCenter(lat,lng,z);}
  function focusBounds(south,north,west,east){
    south=Number(south);north=Number(north);west=Number(west);east=Number(east);
    if(![south,north,west,east].every(Number.isFinite))return;
    const midLat=(south+north)/2, midLng=(west+east)/2;
    const sw=project(south,west,0), ne=project(north,east,0);
    const spanX=Math.max(1,Math.abs(ne.x-sw.x)), spanY=Math.max(1,Math.abs(sw.y-ne.y));
    const pad=72, usableW=Math.max(120,width-pad*2), usableH=Math.max(120,height-pad*2);
    const fit=Math.floor(Math.log2(Math.min(usableW/spanX,usableH/spanY)));
    const targetZoom=clamp(Number.isFinite(fit)?fit:5,3,17);
    setCenter(midLat,midLng,targetZoom);
  }
  function reset(){setCenter(20,0,2);root?.querySelector('.map-popup-card')?.remove();}
  function getZoom(){return zoom;}
  window.TravelMap={init,render,focus,focusCoords,focusBounds,reset,getZoom};
})();
