import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@300;400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#f9f9f7;font-family:'Inter',system-ui,sans-serif;}
input,select,textarea,button{font-family:'Inter',system-ui,sans-serif;}
input:focus,select:focus,textarea:focus{outline:none;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:#d0d0cc;border-radius:4px;}
input[type=range]{accent-color:#3a7d1e;}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.6;transform:scale(.85);}}
.au{animation:fadeUp .25s ease both;}
.pdot{animation:pulseDot 1.8s ease infinite;}
`;

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────
const LS = {
  get:(k,d)=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):d;}catch{return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}},
};
const SURL='https://mrotnqybqvmvlexncvno.supabase.co';
const SKEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yb3RucXlicXZtdmxleG5jdm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDMxOTksImV4cCI6MjA4OTE3OTE5OX0.KiLs0eI43f32htpb3dEhX9agYTbK91I82d2vqR-nPrI';
const SH={apikey:SKEY,'Authorization':'Bearer '+SKEY,'Content-Type':'application/json','Prefer':'return=representation'};
const db={
  async get(t,q=''){const r=await fetch(SURL+'/rest/v1/'+t+'?'+q,{headers:SH});return r.ok?r.json():[];},
  async upsert(t,data){const r=await fetch(SURL+'/rest/v1/'+t,{method:'POST',headers:{...SH,'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify(data)});return r.ok?r.json():null;},
  async patch(t,data,match){const q=Object.entries(match).map(([k,v])=>k+'=eq.'+v).join('&');const r=await fetch(SURL+'/rest/v1/'+t+'?'+q,{method:'PATCH',headers:SH,body:JSON.stringify(data)});return r.ok?r.json():null;},
  async del(t,match){const q=Object.entries(match).map(([k,v])=>k+'=eq.'+v).join('&');await fetch(SURL+'/rest/v1/'+t+'?'+q,{method:'DELETE',headers:SH});}
};

const USERS=[
  {username:"admin",    password:"aryes2024", role:"admin",    name:"Administrador"},
  {username:"operador", password:"stock123",  role:"operador", name:"Operador"},
  {username:"vendedor", password:"ventas123", role:"vendedor", name:"Vendedor"},
];


// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — Aryes palette
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Backgrounds — clean white like Lovable
  bg:       "#f9f9f7",
  card:     "#ffffff",
  cardWarm: "#fafaf8",
  muted:    "#f0f0ec",
  hover:    "#e8e8e4",

  // Borders
  border:   "#e2e2de",
  borderDk: "#c8c8c4",

  // Text
  text:     "#1a1a18",
  textMd:   "#3a3a38",
  textSm:   "#6a6a68",
  textXs:   "#9a9a98",

  // Brand — Aryes green (bright leaf green from logo)
  green:    "#3a7d1e",
  greenBg:  "#f0f7ec",
  greenBd:  "#b8d9a8",

  // Accents
  amber:    "#d97706",
  amberBg:  "#fef3c7",
  red:      "#dc2626",
  redBg:    "#fef2f2",
  redBd:    "#fecaca",
  blue:     "#2563eb",
  blueBg:   "#eff6ff",
  blueBd:   "#bfdbfe",

  // Alert levels
  urgent:   "#dc2626",
  urgentBg: "#fef2f2",
  urgentBd: "#fecaca",
  warning:  "#d97706",
  warnBg:   "#fffbeb",
  warnBd:   "#fde68a",
  watch:    "#2563eb",
  watchBg:  "#eff6ff",
  watchBd:  "#bfdbfe",
  ok:       "#16a34a",
  okBg:     "#f0fdf4",
  okBd:     "#bbf7d0",

  // Typography
  serif:    "'Playfair Display', 'Georgia', serif",
  sans:     "'Inter', system-ui, sans-serif",
};

// ─────────────────────────────────────────────────────────────────────────────
// ARYES LOGO SVG (hoja verde + wordmark, fiel al original)
// ─────────────────────────────────────────────────────────────────────────────
const ARYES_LOGO_B64 = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAH0AfQDASIAAhEBAxEB/8QAHAABAQADAAMBAAAAAAAAAAAAAAEGBwgCBAUD/8QAQxABAAEDAwIEAwYDAgsJAAAAAAECAwQFBhEhMQcSQWFRcYEIExQiMpEVQqFywRYjRFJic4KiscLRFyQlQ2ODo+Hw/8QAGwEBAAIDAQEAAAAAAAAAAAAAAAQFAwYHAgH/xAA0EQEAAQIDBQYEBgIDAAAAAAAAAQIDBAUREiExQVEGImFxgZETocHRFDJisfDxI1IkQsL/2gAMAwEAAhEDEQA/AOMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB53rVyzdqtXaKqK6Z4qpqjiYeBxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABaI5qiPdHuaJj/AIrWcLG45+9yKKP3qiHmqqKaZmeRM6Nr/aI2hThWtL3Vh2vLayrFuzl+WOkXIpjy1fWI4+jTjtvee2rO49jZugXPLFV3H8tmqf5LlMc0VfvEfTlxRk2buNkXMe/RNF21XNFdM96aoniYap2QzT8ZhZtVT3qJ09J4fb0QcBd26NmeMPzAbanAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADNvA/SK9Y8TdJsxR5qLFz8Rc6dIpojnr9eI+rCXT32Ytm16Rt+9uPOs+XL1GIizFUdabMdf96ev0hRdpMxpwOX11TO+qNI85+3FHxV2LdqZbi8nEOO/HvR40fxO1Oiijy2smYyaOI4j88cz/Xl2LM8Ob/tcYVNvXtD1CJ/NfxrlqY/sVRP/ADud9iMTNvMvh8q4mPbf9FVl1el7Tq0cA7CvQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGS+HOztS3puG1pmDRNNqJirJvzH5bNHrM+/wj1Yr9+3YtzduTpTG+ZfKqopjWWQ+Bnh/c3nuGnJzbVX8Gwq4qyKu0XZ7xbiff19nXduii1bptW6KaKKYiKaaY4iIj0fN2voOm7a0LH0jTLFNnHs08e9U+tU/GZfD3fuPItbo0Tauk1f9+zrk3siviJ+5xqOtU/OqekfX2cXzjM72e4zubqKYnSOkRvmZ/ngosRcnE16RwhltX6mi/tcYtNWhaHm/wA1vKuWo+VVMT/yN6TTxDSP2tblMbW0ezz+arOmqI9otzH98PHZaZjNbOnWf2ljwe6/To5tAdwbEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM60nw11TcWiTq20svG1ii3xF/FiuLeRZqn0mmrpPzievowV9faW49W2trNrVdHyqrF+jpVHP5blPrTVHrCJjKMRNvXDVRFUdY1ifCefrDxcivZ7nF6mr6XqWkZlWHquBlYORT1m3kWpoq4+PE+nu9N2NsncW2fFXanOdp+NevW48uXh36Yqm1V8aZ78T6THDXnib4DW6bF3U9mXK/PTzVXp92efNH/p1fH/Rn9/Sdawfa618ecNjqPhVxu6xr58v28UWjG07WzcjSXPg/TJsXsbIuY+RartXrdU010VxxNMx3iYfnHWeIbfExMawmvrbS2/qW59ex9G0qz95kX6u8/oop9aqp9Ih2V4dbQ07Ze3LWl4NMVXOPNkX5j812v1mfb4R6QxX7P2xLe1trW9TzbUfxbUKIuXJmOtqierNEfTrPv8myq6uXIO1mf1Y+9OGsz/jpn3nr5dPdSY3FbdWxTwh43auky1r4TUzuDeG5d7Xea7dy/wDgMCqe0Wbc/mmPaZiP2ff8Wddq2/sLVM+1VxkzZmzj8d/vK/y0zHy55+j3fDbQo25sjS9Kmny3LVimb39uetX9ZUtn/j4C5c53J2Y8o31f+Y92Cmdi1NXXcyGuXOv2uMymvN0DApq/NRbvXqqfaqaIif8AdqdDXJckfaJ1b+J+JeXapq81vCt0Y9PtMRzP9ZXHYrDzczOK/wDWJn5afVky+jW9E9GuQHYl8AtVNVMxFVMxzHPWAQFgEFQAFjuCAAC/QBAX0BAAAWQQAAAAAAXqAgsx6wgAAAAAAAAAAAAAAAAAAAAAAAAMl8N925uzN042r4s1VWoq8uTZ56Xbc94+frE/F2ppWoYuq6Zjalg3Yu42Tbi5bqj1iYcDOo/ssa7VqOyMjSLtc1XdNv8AlpiZ7W6+sf1ir9mgducrprsRjaY71O6fGJ4e0/urMxs60/EjjDz8fPDG1uTT7u4NExojWcejzXKLcdcqiPTj1rj0+Pb4Ocdl41GXu/ScW9H5LmZbpqifh5od0c8S5n8dtozs/e+Du/TbExp2TlU3bkUx0tXonzTHtFUczH1QeyWeV10VZfdq3zE7E+nD7e3RjwWImY+HM+TpmmIpoimmOIiOIh+dUvHAybebp2PmWaoqt37VNyiY7TExzBcieXPtmYmYniqp3cWs/Fi5Gqb32ZteZ81u/nfjL9E9YqotRzxPz4ltKqeKYhpW3lRq32n5s880aXp/3dP9qaYqmf8A5OPo3NXPuuc2tzZtYe1+ja9apmf20Sr8bNNFPhr7vnbk1XG0XQ83Vsyry2MWzVdr9+I7R7z2hw7q+de1PVcrUcmeb2Tequ1/OqeXQP2pN0042kY218e5/jcuYvZERPa3TP5Yn5zH9HOjf+xOXfAwtWJqjfXw8o+8/RZZfa2aNqeYPb0nTdQ1bNowtNw72XkVzxTbtUTVMt++FngZRiV2tW3lNF27TMVW8CieaKf9ZPr8o6e8thzTOcLltvaT1b+Uc59PrwS7l6m3GtUsJ8J/DijUcC7vDddFeNt3Ct1X/LVzTOTFMczx6+Xp6d+0NeRg1GrVtay9RqtUWov3Jqpt0REU26f5aYiPSI4j6N6/af3hbxsPH2XptdNEVRTcy6aOkUUR+ij2+PHtDntEyK7iMbTVjr+7b/LT0p+8858IebFVVcbc8+AqDYGc7C+iALHeEWO4E9ye6T3We8gECAL2QAkVAWPiiygLT+qPmT3SOkr0+E/uCC9PhJ6SCLHdAAU4AQAAAAAAAAAAAAAAAAAAAAAAAAAG3Psr6pVieIV/T5qmLedh1R5fSa6JiqJ/bzfu1GzTwQzPwXilod3niK782p/2qZp/vVed2Yv5feon/WflGsMOIp2rVUeDr7+JWp1+rR6qaqb040ZFFUz0rp8001RHvHT94ervTQMXc2187RMumJoyLcxTVMforjrTVHynh8nxGuTpGRou66elrTsqLWbPwxr3FFVU+1M+Wr6MxqiOkxMTE9pj1cPnWxFrEWp0+lVM/wBT6tfnu6Vw1l9n3Wcm7t3K2nqvNOqbfv1Y1dNU9Zt8z5Z+nWPlENkV09erW++rNGz/ABC0vfluJt4OZVTgaxxHSKaulF2flPHPtDZlUUzEVUzFUTHMTE90nNtm5djFW40pub/Kr/tHvv8AKYfb8RNW3HCf5Lnbwkv1Z32hdyZk1eaPPkxE+33kRH9IhvTcGqYujaPl6pm1+SxjWpuVz7RDnz7PuRT/ALuuRXPFd2i9Mc/6zqyLxu1TUd3biwvDjbfF25XXF3Orpn8tHHaKp9Ij9U/Rs+b5d+KzWi1M6UU0U6z0piN8/zmmXrW3finlEQ0juTU9U3pvHJz6bF7JzM69xZsWqZrqintTRTEfCIhtXYXgBnZdNvM3ZmThWp6/hLExN2faausR9OW4fDfw+0LZGn00YVmm/n1U8X8y5T+eufWI/zafaHs7r3BkY+Va0HQbdGTruVTzRTV1oxrfreu/CmPSO9U9PjMe8d2rvXpjC5ZGxREabXhHPwiPfyZq8VM9y0mg6VtLaORjaFouBYxsm/TNUUWqPPdqpjvXXVPM8enMz36QeIW6MXaW18rWMqaZm3Hls25nrcuT+mmP/3aJexoGh4O28LIyLmRVk5l7/G52fkVfnuzEdZmfSmPSI6RDlzxv3zVvHcs28S5V/CsKZoxo56Vz63OPf09lVk+VTm+O31TVRTvqqnn/fLnpv8ABit2fjV79/VhWtall6xq2Vqmfdm7k5NyblyqfWZ/u9HpiuyU0xRTFNMaRC4iNNwIPQpPdABY7wEd4AnuTHE8JPdZ7yAgAAASvoSSCAAsdZg5j4QU/qhJ7gvPtBz7IAAvoCAAveEWP7kAAAAAAAAAAAAAAAAAAAAAAAAAe7oWdVputYWoUTMTj36LvT2mJekPNVMVUzTPCXyY13O86rWDuHblVm/TTfwdRxfLXET0qorp9PpL4vhpn369Kv7e1G5NWp6HXGLemrvct8f4q58qqY/eJYd9mbdsa1s/+BZV3nN0r8lPM9a7M/pn6fp+UQyHxFws7RtRx9+aHbquZODR91qWNR/leJzzP+1R3j6uHXsDVh8Tdy65Ok692fHl6VRu89NeDXpommqbU/z+2T7p0bF3Dt7O0XNjmzl2arczHemZjpVHvE8THyYx4L6zk5u2ruhanV/4toV2cLKiZ6zFP6KvlMR39mWaDq+na9pNjVdJyaMjEv0+aiqnvHxiY9Jj1hrndFU7L8ZtK3DH5NL3DR+AzuP003o48lU+/b9qmLBW6r1u7gq40q/NTH6qeMeta+sQ+URNVM254/Zzvkaxqe1vEHUc/Sr0WMvHy79umqaYqjrNUTzE9J/+nRH2c9s1adti5uXUfNd1XWavva71zrXFvnpHM/Oes/T4OfN/afcv+LOtabap5uXtYu27cfGarsxH/GHY1H4XRtEoo81NrEw7EU8z2poop/6Q3Ltdi9nBWbduO9diNZ5zEaTEe8rHF16UUxHGXzN9bmp2/ptucex+M1PLuRYwMSJ4m/dntHtTHeZ9IeWy9Bq0PBu5GdejK1jOq++z8nj9df8Am0/CintEMM8MfxO8tzZniBqNE04dqqvF0SzV/JbieK7nzntz849HyfHbxVo0axd27oF7z6pcjy379M9Gen4R/pz/AEazbyu9cuxl2Hjvzvrnp4eVPPrV5Qj02p1+HTx5vhfaK8Sqb0XtoaHkRVTE+XUL1E/D/wAqJ/4/t8WhFqqqqqmqqZqqmeZme8yjreVZZZy3DxYtes9Z6ra1ai1TswAvMrFkEAAABY7wcycgk91nvJzKAqC8yCCzPKALJzKT1AAAXn2g5k5kDmPhB9DmTmQReyAB3Xn2g5kDtHCAAAAAAAAAAAAAAAAAAAAAAAAAAADIfDzdOZs/dOLrWJzXTbny37XPEXbc/qp/6e8Q7S0HVtP1/RcbVNPu03sXKtxVTPz7xMfGO0w4MZt4ZeJGt7HyZoxuMvTrlXmu4lyrimfemf5Zaj2o7OzmdEXrG65T846efRCxeF+L3qeLce4bOo+Ee6Lm4dIs3cnaGo3ec7Do/wAlrmf1U/CPh+3wZR4o2MDfXhFl5+jZFORTbtxnYl2jvTXb6zHtPHmifm/faXiFszfeDVgU37cXciiaL2BmREVVRPeOO1X0lrDe2HuLwb1LIy9uVfitr6pFVuvFv8263Ez+WfWJ47T69p7NRw1q7icTbou1xFNqrouoiYp/Vr0nnHFCpiaaNvCFQbAznYX0QBY7wix3AnuT3Se6z3kAgQBeyAEioCx8UWUBaf1R8ye6R0lenQn9wQXp8JPSQRYbqACnACAAAAAAAAAAAAAAAAAAAAAAAAAAN2fZX1SrE8Qr+nzVMW87DqjzekV0TFUT+3m/dqNmvghdfgvFLQ7vPEV35tT/tUzT/eq87sxfy/XRP+s/KNYYcRT0tVo8Hxr+JWp1+rR6qaqb040ZFFUz0rp8001RHvHT94ervTQMXc2187RMumJoyLcxTVMforjrTVHynh8nxGuTpGRou66elrTsqLWbPwxr3FFVU+1M+Wr6MxqiOkxMTE9pj1cPnWxFrEWp0+lVM/wBT6tfnu6Vw1l9n3Wcm7t3K2nqvNOqbfv1Y1dNU9Zt8z5Z+nWPlENkV09erW++rNGz/ABC0vfluJt4OZVTgaxxHSKaulF2flPHPtDZlUUzEVUzFUTHMTE90nNtm5djFW40pub/Kr/tHvv8AKYfb8RNW3HCf5Lnbwkv1Z32hdyZk1eaPPkxE+33kRH9IhvTcGqYujaPl6pm1+SxjWpuVz7RDnz7PuRT/ALuuRXPFd2i9Mc/6zqyLxu1TUd3biwvDjbfF25XXF3Orpn8tHHaKp9Ij9U/Rs+b5d+KzWi1M6UU0U6z0piN8/zmmXrW3finlEQ0juTU9U3pvHJz6bF7JzM69xZsWqZrqintTRTEfCIhtXYXgBnZdNvM3ZmThWp6/hLExN2faausR9OW4fDfw+0LZGn00YVmm/n1U8X8y5T+eufWI/zafaHs7r3BkY+Va0HQbdGTruVTzRTV1oxrfreu/CmPSO9U9PjMe8d2rvXpjC5ZGxREabXhHPwiPfyZq8VM9y0mg6VtLaORjaFouBYxsm/TNUUWqPPdqpjvXXVPM8enMz36QeIW6MXaW18rWMqaZm3Hls25nrcuT+mmP/3aJexoGh4O28LIyLmRVk5l7/G52fkVfnuzEdZmfSmPSI6RDlzxv3zVvHcs28S5V/CsKZoxo56Vz63OPf09lVk+VTm+O31TVRTvqqnn/fLnpv8ABit2fjV79/VhWtall6xq2Vqmfdm7k5NyblyqfWZ/u9HpiuyU0xRTFNMaRC4iNNwIPQpPdABY7wEd4AnuTHE8JPdZ7yAgAAASvoSSCAAsdZg5j4QU/qhJ7gvPtBz7IAAvoCAAveEWP7kAAAAAAAAAAAAAAAAAAAAAAAAAe7oWdVputYWoUTMTj36LvT2mJekPNVMVUzTPCXyY13O86rWDuHblVm/TTfwdRxfLXET0qorp9PpL4vhpn369Kv7e1G5NWp6HXGLemrvct8f4q58qqY/eJYd9mbdsa1s/+BZV3nN0r8lPM9a7M/pn6fp+UQyHxFws7RtRx9+aHbquZODR91qWNR/leJzzP+1R3j6uHXsDVh8Tdy65Ok692fHl6VRu89NeDXpommqbU/z+2T7p0bF3Dt7O0XNjmzl2arczHemZjpVHvE8THyYx4L6zk5u2ruhanV/4toV2cLKiZ6zFP6KvlMR39mWaDq+na9pNjVdJyaMjEv0+aiqnvHxiY9Jj1hrndFU7L8ZtK3DH5NL3DR+AzuP003o48lU+/b9qmLBW6r1u7gq40q/NTH6qeMeta+sQ+URNVM254/Zzvkaxqe1vEHUc/Sr0WMvHy79umqaYqjrNUTzE9J/+nRH2c9s1adti5uXUfNd1XWavva71zrXFvnpHM/Oes/T4OfN/afcv+LOtabap5uXtYu27cfGarsxH/GHY1H4XRtEoo81NrEw7EU8z2poop/6Q3Ltdi9nBWbduO9diNZ5zEaTEe8rHF16UUxHGXzN9bmp2/ptucex+M1PLuRYwMSJ4m/dntHtTHeZ9IeWy9Bq0PBu5GdejK1jOq++z8nj9df8Am0/CintEMM8MfxO8tzZniBqNE04dqqvF0SzV/JbieK7nzntz849HyfHbxVo0axd27oF7z6pcjy379M9Gen4R/pz/AEazbyu9cuxl2Hjvzvrnp4eVPPrV5Qj02p1+HTx5vhfaK8Sqb0XtoaHkRVTE+XUL1E/D/wAqJ/4/t8WhFqqqqqmqqZqqmeZme8yjreVZZZy3DxYtes9Z6ra1ai1TswAvMrFkEAAABY7wcycgk91nvJzKAqC8yCCzPKALJzKT1AAAXn2g5k5kDmPhB9DmTmQReyAB3Xn2g5kDtHCAAAAAAAAAAAAAAAAAAAAAAAAAAADIfDzdOZs/dOLrWJzXTbny37XPEXbc/qp/6e8Q7S0HVtP1/RcbVNPu03sXKtxVTPz7xMfGO0w4MZt4ZeJGt7HyZoxuMvTrlXmu4lyrimfemf5Zaj2o7OzmdEXrG65T846efRCxeF+L3qeLce4bOo+Ee6Lm4dIs3cnaGo3ec7Do/wAlrmf1U/CPh+3wZR4o2MDfXhFl5+jZFORTbtxnYl2jvTXb6zHtPHmifm/faXiFszfeDVgU37cXciiaL2BmREVVRPeOO1X0lrDe2HuLwb1LIy9uVfitr6pFVuvFv8263Ez+WfWJ47T69p7NRw1q7icTbou1xFNqrouoiYp/Vr0nnHFCpiaaNvCFQbAznYX0QBY7wix3AnuT3Se6z3kAgQBeyAEioCx8UWUBaf1R8ye6R0lenQn9wQXp8JPSQRYbqACnACAAAAAAAAAAAAAAAAAAAAAAAAAAN2fZX1SrE8Qr+nzVMW87DqjzekV0TFUT+3m/dqNmvghdfgvFLQ7vPEV35tT/tUzT/eq87sxfy/XRP+s/KNYYcRT0tVo8Hxr+JWp1+rR6qaKb040ZFFUz0rp8001RHvHT94ervTQMXc2187RMumJoyLcxTVMforjrTVHynh8nxGuTpGRou66elrTsqLWbPwxr3FFVU+1M+Wr6MxqiOkxMTE9pj1cPnWxFrEWp0+lVM/wBT6tfnu6Vw1l9n3Wcm7t3K2nqvNOqbfv1Y1dNU9Zt8z5Z+nWPlENkV09erW++rNGz/ABC0vfluJt4OZVTgaxxHSKaulF2flPHPtDZlUUzEVUzFUTHMTE90nNtm5djFW40pub/Kr/tHvv8AKYfb8RNW3HCf5Lnbwkv1Z32hdyZk1eaPPkxE+33kRH9IhvTcGqYujaPl6pm1+SxjWpuVz7RDnz7PuRT/ALuuRXPFd2i9Mc/6zqyLxu1TUd3biwvDjbfF25XXF3Orpn8tHHaKp9Ij9U/Rs+b5d+KzWi1M6UU0U6z0piN8/zmmXrW3finlEQ0juTU9U3pvHJz6bF7JzM69xZsWqZrqintTRTEfCIhtXYXgBnZdNvM3ZmThWp6/hLExN2faausR9OW4fDfw+0LZGn00YVmm/n1U8X8y5T+eufWI/zafaHs7r3BkY+Va0HQbdGTruVTzRTV1oxrfreu/CmPSO9U9PjMe8d2rvXpjC5ZGxREabXhHPwiPfyZq8VM9y0mg6VtLaORjaFouBYxsm/TNUUWqPPdqpjvXXVPM8enMz36QeIW6MXaW18rWMqaZm3Hls25nrcuT+mmP/3aJexoGh4O28LIyLmRVk5l7/G52fkVfnuzEdZmfSmPSI6RDlzxv3zVvHcs28S5V/CsKZoxo56Vz63OPf09lVk+VTm+O31TVRTvqqnn/fLnpv8ABit2fjV79/VhWtall6xq2Vqmfdm7k5NyblyqfWZ/u9HpiuyU0xRTFNMaRC4iNNwIPQpPdABY7wEd4AnuTHE8JPdZ7yAgAAASvoSSCAAsdZg5j4QU/qhJ7gvPtBz7IAAvoCAAveEWP7kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//2Q==";

const AryesLogo = ({ height = 36 }) => (
  <img src={ARYES_LOGO_B64} height={height} alt="Aryes" style={{display:"block"}}/>
);


const avgDaily   = h => (!h?.length ? 0 : h.reduce((s,x)=>s+x.consumed,0)/h.length/30);
const stdDev     = h => {
  if(!h||h.length<2) return 0;
  const ds=h.map(x=>x.consumed/30), m=ds.reduce((s,v)=>s+v,0)/ds.length;
  return Math.sqrt(ds.reduce((s,v)=>s+Math.pow(v-m,2),0)/ds.length);
};
const safetyStock = (h,lead) => Math.ceil(1.65*stdDev(h)*Math.sqrt(lead));
const rop         = (h,lead) => Math.ceil(avgDaily(h)*lead+safetyStock(h,lead));
const eoq         = (h,cost) => {
  const ann=avgDaily(h)*365, hc=cost*0.25;
  if(!hc||!ann) return 0;
  return Math.ceil(Math.sqrt(2*ann*25/hc));
};
const totalLead   = s => Object.values(s?.times||{}).reduce((a,b)=>a+b,0);

const alertLevel = (p, s) => {
  if(!s||!p.history?.length) return {level:"ok",daysToROP:999,daysOut:999,rop:0,ss:0,eoq:0,daily:0};
  const lead=totalLead(s), daily=avgDaily(p.history);
  const r=rop(p.history,lead), ss=safetyStock(p.history,lead), eq=eoq(p.history,p.unitCost);
  const daysToROP = daily>0 ? Math.max(0,Math.floor((p.stock-r)/daily)) : 999;
  const daysOut   = daily>0 ? Math.floor(p.stock/daily) : 999;
  const level = p.stock<=r ? "order_now" : daysToROP<=5 ? "order_soon" : daysToROP<=10 ? "watch" : "ok";
  const ropDate=new Date(); ropDate.setDate(ropDate.getDate()+daysToROP);
  return {level,daysToROP,daysOut,rop:r,ss,eoq:eq,daily,ropDate};
};

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT DATA
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SUPPLIERS = [
  {id:"arg",name:"Argentina",flag:"AR",color:"#1d4ed8",times:{preparation:2,customs:1,freight:4,warehouse:1},
   company:"Distribuidora del Sur S.A.",contact:"Martín Rodríguez",email:"martin@distrsur.com.ar",phone:"+54 11 4523-7890",whatsapp:"+54 9 11 4523-7890",
   country:"Argentina",city:"Buenos Aires",currency:"USD",paymentTerms:"30",paymentMethod:"Transferencia bancaria",
   minOrder:"500",discount:"5",rating:5,active:true,
   notes:"Proveedor principal. Envíos martes y jueves. Pedido mínimo USD 500. Descuento 5% por volumen >USD 2000."},
  {id:"ecu",name:"Ecuador",flag:"EC",color:"#15803d",times:{preparation:3,customs:4,freight:8,warehouse:2},
   company:"Tropical Ingredients Cia. Ltda.",contact:"Andrea Vásquez",email:"avasquez@tropicalingr.ec",phone:"+593 2 234-5678",whatsapp:"+593 99 234-5678",
   country:"Ecuador",city:"Guayaquil",currency:"USD",paymentTerms:"50",paymentMethod:"Carta de crédito",
   minOrder:"800",discount:"0",rating:4,active:true,
   notes:"Cacao y derivados. Temporada alta oct–dic coincide con cosecha. Precios suben ~15% en enero."},
  {id:"eur",name:"Europa",flag:"EU",color:"#6d28d9",times:{preparation:5,customs:10,freight:25,warehouse:3},
   company:"Europastry Ingredients GmbH",contact:"Klaus Bauer",email:"k.bauer@europastry.de",phone:"+49 89 1234-5678",whatsapp:"",
   country:"Alemania",city:"Múnich",currency:"EUR",paymentTerms:"60",paymentMethod:"Swift / Wire transfer",
   minOrder:"2000",discount:"8",rating:5,active:true,
   notes:"Vainilla, especias y mejoradores premium. Lead time muy largo — planificar con 2 meses de anticipación. Descuento 8% en pedidos >EUR 5000."},
  {id:"other",name:"Otros",flag:"—",color:"#b45309",times:{preparation:3,customs:5,freight:12,warehouse:2},
   company:"",contact:"",email:"",phone:"",whatsapp:"",
   country:"",city:"",currency:"USD",paymentTerms:"30",paymentMethod:"",
   minOrder:"0",discount:"0",rating:3,active:true,notes:""},
];

const gh=(base,v)=>Array.from({length:6},(_,i)=>{
  const d=new Date();d.setMonth(d.getMonth()-(5-i));
  return{month:d.toISOString().slice(0,7),consumed:Math.max(1,Math.round(base*(1+(Math.random()-.5)*v)))};
});

const DEFAULT_PRODUCTS = [
  {id:1,name:"Chocolate Cobertura Confeiteiro con Leche 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:336.07,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:2,name:"Chocolate Cobertura Confeiteiro Semiamargo 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:336.07,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:3,name:"Chocolate Cobertura Confeiteiro Blanco 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:336.07,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:4,name:"Chocolate Cobertura Supreme Amargo 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:5,name:"Chocolate Gotas Supreme con Leche 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:6,name:"Chocolate Gotas Supreme Semiamargo 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:7,name:"Chocolate Gotas Supreme Blanco 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:8,name:"Chocolate Ganache con Leche 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:9,name:"Chocolate Ganache Semiamargo 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:10,name:"Chocolate Ganache Blanco 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:11,name:"Chocolate Chips Negro 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:12,name:"Chocolate Chips Blanco 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:13,name:"Cacao polvo Namur 500 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:659.84,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:14,name:"Cacao polvo Namur 10 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:459.02,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:15,name:"Chocolate Granizado (mini gotas) semiamargo 8 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:282.79,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:16,name:"Microgalletitas b/chocolate 7 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:680.33,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:17,name:"Relleno y Cobertura Chantilly 4,7 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:18,name:"Relleno y Cobertura Vainilla 4,7 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:19,name:"Relleno y Cobertura Frutilla 4,7 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:20,name:"Relleno y Cobertura Chantilly 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:21,name:"Relleno y Cobertura Vainilla 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:22,name:"Relleno y Cobertura Frutilla 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:23,name:"Relleno y Cobertura Chantilly 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:303.28,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:24,name:"Relleno y Cobertura Vainilla 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:303.28,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:25,name:"Relleno y Cobertura Frutilla 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:303.28,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:26,name:"Relleno y Cobertura Sabor Chocolate por 4,5 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:27,name:"Relleno y Cobertura Sabor Chocolate  por 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:327.87,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:28,name:"Relleno y Cobertura Sabor Chocolate  por 500 g.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:360.66,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:29,name:"Merengue en polvo por 250 grs. (1 kg. polvo + 400 cc.agua+12 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:385.25,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:30,name:"Merengue en polvo por 4 kgs. ( 1 kg. polvo + 400 cc.agua+12 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:31,name:"Crema pastelera por 250 grs. (750 cc. agua + 250 gr.polvo + 5 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:418.03,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:32,name:"Crema pastelera por 4 Kg. (750 cc. agua + 250 gr.polvo + 5 min batido)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:319.67,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:33,name:"Mousse Chantilly 250 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:627.05,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:34,name:"Mousse Frutilla 250 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:627.05,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:35,name:"Mousse Chocolate 250 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:627.05,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:36,name:"Mousse Chantilly 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:602.46,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:37,name:"Mousse Frutilla 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:602.46,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:38,name:"Mousse Chocolate 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:602.46,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:39,name:"Gel de Brillo Neutro 310 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:237.7,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",history:gh(180,0.5)},
  {id:40,name:"Gel de Brillo Frutilla 310 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:237.7,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",history:gh(180,0.5)},
  {id:41,name:"Destello Neutro 4,4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:159.84,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",history:gh(180,0.5)},
  {id:42,name:"Destello Frutilla 4,4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:159.84,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",history:gh(180,0.5)},
  {id:43,name:"Gel de Brillo Neutro en Caliente por 10 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:131.15,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",history:gh(180,0.5)},
  {id:44,name:"Crema Paris (cubretortas chocolate intenso) por 280 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:401.64,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",history:gh(180,0.5)},
  {id:45,name:"Crema Paris (baño tipo ganache) por 4 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:327.89,minStock:5,dailyUsage:0.5,category:"Brillos",brand:"Ledevit",history:gh(180,0.5)},
  {id:46,name:"Mix Cupcake vainilla 500 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:233.61,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:47,name:"Mix Brownie 470 grs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:258.2,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:48,name:"Mix Brownie 4 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:49,name:"Mix Budín vainilla 500 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:213.11,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:50,name:"Mix Macarrones 250 grs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:532.79,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:51,name:"Mix Macarron 3,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:422.13,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:52,name:"Azúcar impalpable 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:176.23,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:53,name:"Glacé Real 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:213.11,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:54,name:"Fondant 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:196.72,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:55,name:"Pastamix 800 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:307.38,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:56,name:"Pastamix 3 kgs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:1020.49,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:57,name:"Pasta Americana Colorful 800 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:315.57,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:58,name:"Rendamix 100 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:155.74,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:59,name:"Pasta Americana Mix 4,5 kgs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:1536.89,minStock:5,dailyUsage:0.5,category:"Decoración",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:60,name:"Azúcar Colores 80 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:45.08,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:61,name:"Azúcar Colores 500 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:131.15,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:62,name:"Granas Colores 120 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:45.08,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:63,name:"Granas Colores 500 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:131.15,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:64,name:"Grageas Colores 100 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:53.27,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:65,name:"Grageas Colores 500 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:159.84,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:66,name:"Granas Colores 5 kgrs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:163.93,minStock:5,dailyUsage:0.5,category:"Confites",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:67,name:"Aromatizante Limón 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:68,name:"Aromatizante Nuez 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:69,name:"Aromatizante Chocolate 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:70,name:"Aromatizante Naranja 30 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:61.48,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:71,name:"Aromatizante Vainilla 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:72,name:"Aromatizante Vainilla Blanca 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:217.21,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:73,name:"Aromatizante Chocolate 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:74,name:"Aromatizante Coco 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:75,name:"Aromatizante Manteca 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:76,name:"Aromatizante Frutilla 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:77,name:"Aromatizante Queso 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:78,name:"Aromatizante Panettone 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:79,name:"Aromatizante Naranja 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:80,name:"Aromatizante Limón 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:81,name:"Aromatizante Menta 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:82,name:"Color gel 15 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:65.57,minStock:5,dailyUsage:0.5,category:"Colorantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:83,name:"Color softgel 25 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:110.66,minStock:5,dailyUsage:0.5,category:"Colorantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:84,name:"Color softgel Big 150 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:352.46,minStock:5,dailyUsage:0.5,category:"Colorantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:85,name:"Color polvo esfumado 3 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:139.34,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:86,name:"Color pen 60 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:135.25,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:87,name:"Color líquido 10 ml.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:45.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:88,name:"Colorante liquido 1 lt.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:155.74,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:89,name:"Acido Cítrico 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:90,name:"Agar Agar 30 g",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:299.18,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:91,name:"CMC (Carbometil Celulosa) 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:110.65,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:92,name:"Cremor Tártaro por 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:93,name:"Gel Confitero 50 grs",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:94,name:"Glucosa jarabe 150 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:98.36,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:95,name:"Glucosa jarabe 500 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:163.93,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:96,name:"Glucosa jarabe 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:97,name:"Glucosa polvo (dextrosa) 50 g.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:81.97,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:98,name:"Emustab (Emulsificante) 200 grs.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:121.32,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:99,name:"Emustab por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:418.03,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:100,name:"Gelatina neutra por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Aditivos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:101,name:"CHOCOLATE AMARGO DARK 70% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1385.25,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:102,name:"CHOCOLATE AMARGO DARK 70% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1295.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:103,name:"CHOCOLATE AMARGO BLACK 65% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1229.51,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:104,name:"CHOCOLATE AMARGO BLACK 65% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1200.82,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:105,name:"CHOCOLATE FLUIDO 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1217.21,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:106,name:"CHOCOLATE FLUIDO 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1192.62,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:107,name:"CHOCOLATE S/AMARGO 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1118.85,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:108,name:"CHOCOLATE S/AMARGO 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1045.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:109,name:"CHOCOLATE C/LECHE CARAMELIZADO 40% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:110,name:"CHOCOLATE C/LECHE BLEND 35% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:111,name:"CHOCOLATE C/LECHE BLEND 35% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1045.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:112,name:"CHOCOLATE BLANCO C/MAIZ 33% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1270.49,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:113,name:"CHOCOLATE BLANCO 31% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:114,name:"CHOCOLATE BLANCO 31% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1045.08,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:115,name:"CACAO POLVO 22-24% 2,25 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1311.48,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:116,name:"NIBS CACAO 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2049.18,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:117,name:"LICOR CACAO 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2000,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:118,name:"CHOCOLATE S/AMARGO TRONADOR 55%",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:119,name:"CHOCOLATE C/LECHE TRONADOR",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:120,name:"CHOCOLATE BLANCO",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:121,name:"CHOCOLATE AMARGO 71%",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1135.25,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:122,name:"Preparado selecta top 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:286.88,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:123,name:"Crema Chocolat 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:442.62,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:124,name:"Variegato Frutales 2 Kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:565.57,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:125,name:"Variegato Frutales 12 Kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:528.69,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:126,name:"Variegato Frutales Zero 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:655.74,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:127,name:"Veteado Chocolat 2 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:545.08,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:128,name:"Veteado Chocolat 12 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:631.15,minStock:5,dailyUsage:0.5,category:"Variagatos",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:129,name:"Super liga Neutra por 20 kgs. estabilizante en frío ó caliente",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",history:gh(180,0.5)},
  {id:130,name:"Emustab por 10 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:282.79,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",history:gh(180,0.5)},
  {id:131,name:"Emustab por 3 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:327.86,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",history:gh(180,0.5)},
  {id:132,name:"Estabilizante Aqua 5 por 1 kg. en frio",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:549.18,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",history:gh(180,0.5)},
  {id:133,name:"Emulsificante y Estabilizante Laqua 10 por 500 grs. en frio",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:491.8,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",history:gh(180,0.5)},
  {id:134,name:"Base Zero Aqua 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:549.18,minStock:5,dailyUsage:0.5,category:"Estabilizantes",brand:"Selecta",history:gh(180,0.5)},
  {id:135,name:"Cobertura Clásicas  1,3 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:172.13,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:136,name:"Cobertura premium 1,3 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:225.41,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:137,name:"Cobertura Clásicas  300 grs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:377.05,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:138,name:"Soft Vainilla 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Food Service",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:139,name:"Soft Chocolate 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:270.49,minStock:5,dailyUsage:0.5,category:"Food Service",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:140,name:"Chocolate caliente por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:327.87,minStock:5,dailyUsage:0.5,category:"Food Service",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:141,name:"Desmoldante Aerosol Lisse 600 ml",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:368.85,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",history:gh(180,0.5)},
  {id:142,name:"Mejorador Enzipan 250",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:73.77,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",history:gh(180,0.5)},
  {id:143,name:"Mix Pao de queijo por 1 kg.",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:172.13,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",history:gh(180,0.5)},
  {id:144,name:"Caramelo Liquido 7 kg",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:139.34,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",history:gh(180,0.5)},
  {id:145,name:"Lactofil Premium 1 L",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:250,minStock:5,dailyUsage:0.5,category:"Complementos Panadería",brand:"Adimix",history:gh(180,0.5)},
  {id:146,name:"Aceite Doratta 15,8 L (14, kgs)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:2250,minStock:5,dailyUsage:0.5,category:"Aceites y Grasas",brand:"Agropalma",history:gh(180,0.5)},
  {id:147,name:"Grasa Palma 20 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:122.73,minStock:5,dailyUsage:0.5,category:"Aceites y Grasas",brand:"Agropalma",history:gh(180,0.5)},
  {id:148,name:"Anana 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:149,name:"Banana  3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:150,name:"Frambuesa 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:151,name:"Frutilla  3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:918.03,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:152,name:"Mango  3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:153,name:"Maracuyá 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:154,name:"Limón 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:155,name:"Azurro Cielo 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:799.18,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:156,name:"Bubbly 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1213.11,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:157,name:"Biscottino 4,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:995.9,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:158,name:"Biancocioc 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1090.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:159,name:"Cherry 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1122.95,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:160,name:"Cocco 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1032.79,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:161,name:"Caffe por 1 kg.",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:162,name:"Chantilly (pasta per cookies black) 4,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1086.07,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:163,name:"Cheese Cake en polvo 1 kg",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1295.083,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:164,name:"Limoncello en polvo con estabilizante 2,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:165,name:"Mascarpone en polvo 2 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1500,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:166,name:"Yoghin yogurth en polvo 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1196.72,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:167,name:"Limone 50 en polvo con estabilizante 2,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1155.74,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:168,name:"Menta 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:952.82,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:169,name:"Mister Nico Pasta mani 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1180.33,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:170,name:"Pistacho California 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:4147.54,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:171,name:"Pistacho Pesto c/trozos 2,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:3581.97,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:172,name:"Nocciola Prima Fine (avellana) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2151.64,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:173,name:"Nocciola Selection (avellana) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1491.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:174,name:"Nocciola Oscura (avellana) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1627.05,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:175,name:"Nocciola Máxima (kinder) 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2340.16,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:176,name:"Sinfonía Italiana KIT 12,7 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:177,name:"Tiramisu 4,5 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1040.98,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:178,name:"Vainilla French 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:1159.84,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:179,name:"Zabaione 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:180,name:"Cookie Black Oreo 6 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:181,name:"Cookie Lemon 6 kg.",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:182,name:"Fiordibosco 3 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:183,name:"Mamá que buena kinder 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:967.21,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:184,name:"Mecralph 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1254.1,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:185,name:"Mecrock 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1282.79,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:186,name:"Mecrock Plus 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1176,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:187,name:"Mister Nico Snickers 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:877.05,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:188,name:"Quello Caramelo 6 kg.",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:189,name:"Wafer 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1073.77,minStock:5,dailyUsage:0.5,category:"Pastas",brand:"MEC3",history:gh(180,0.5)},
  {id:190,name:"Base Soave 2 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:831.97,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:191,name:"Base Elena 1,8 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:840.16,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:192,name:"Supergelmix 3 kgs",barcode:"",supplierId:"eur",unit:"lt",stock:0,unitCost:938.52,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:193,name:"Cioki 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:655.74,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:194,name:"Cremfix 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:643.44,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:195,name:"Cacao polvo 20-22",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:926.23,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:196,name:"Stracciatella",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:606.56,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:197,name:"Gianduia 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1311.48,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:198,name:"Torrone Rustico 4,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1491.8,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:199,name:"Frollino 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:926.23,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:200,name:"Amore Nocciola 5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:950.82,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:201,name:"Arancio Variegato 3,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:778.68,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:202,name:"Pistacho al Gusto 4 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1729.51,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:203,name:"Pistacho Natura 2,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:3950.82,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:204,name:"Pistacho Maestro 2,5",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:2983.61,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:205,name:"Morettina Clásica 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:696.72,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:206,name:"Morettina Blanca 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:696.72,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:207,name:"Morettina Pepita Clásica 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1172.13,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:208,name:"Morettina Pepita Blanca ,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1172.13,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:209,name:"Morettina Pistacho 6 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1721.31,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:210,name:"Morettina Pastelera Clásica 12 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:614.75,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:211,name:"Morettina Pastelera Pistacho 5,5 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:942.62,minStock:5,dailyUsage:0.5,category:"Chocolates Gelatieri",brand:"Pernigotti",history:gh(180,0.5)},
  {id:212,name:"Cacao polvo Namur 10 Kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:491.8,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:213,name:"Pasta Saborizante 2 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:491.8,minStock:5,dailyUsage:0.5,category:"Pastas Saborizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:214,name:"Dia & Light Vaniglia 1,25 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1159.84,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:215,name:"Dia & Light Fiordilatte 1,25 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1180.33,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:216,name:"Dia & Light Fuit 1 kg",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1098.36,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:217,name:"Dia & Light Cioccolatto 1,25 kgs",barcode:"",supplierId:"eur",unit:"kg",stock:0,unitCost:1295.08,minStock:5,dailyUsage:0.5,category:"Bases",brand:"MEC3",history:gh(180,0.5)},
  {id:218,name:"Chocolate Amargo Dark 70% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:844.26,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:219,name:"Chocolate Amargo Dark 70%  70% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:220,name:"Chocolate Amargo Black 65% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:844.26,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:221,name:"Chocolate s/Amargo 56% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:762.29,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:222,name:"Chocolate s/Amargo 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:688.52,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:223,name:"Chocolate s/Amargo 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:663.3,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:224,name:"Chocolate Fluido 56% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:991.8,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:225,name:"Chocolate Fluido 56% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:717.21,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:226,name:"Chocolate Fluido 56% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:696.72,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:227,name:"Chocolate c/Leche Caramelizado 40% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:228,name:"Chocolate c/Leche 35% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:872.95,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:229,name:"Chocolate c/Leche 35% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:230,name:"Chocolate c/Leche 35% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:786.89,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:231,name:"Chocolate Blanco c/Maiz 33% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:844.26,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:232,name:"Chocolate Blanco 31% 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:946.72,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:233,name:"Chocolate Blanco 31% 2,5 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:827.87,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:234,name:"Chocolate Blanco 31% 15 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:786.9,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:235,name:"Cacao Polvo 22-24% 2,25 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:926.23,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:236,name:"Nibs Cacao 1 kgs",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:1065.57,minStock:5,dailyUsage:0.5,category:"Chocolates",brand:"Selecta",history:gh(180,0.5)},
  {id:237,name:"Palitos Clásico enfajados 114x10x2mm por 10.000 (200x50 pcs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2700.82,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:238,name:"Palitos Hélice enfajados 200x50 pcs 94x17-11x2 por 5.000 (100x50 pcs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:2573.77,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:239,name:"Palitos Redondo 160 x 6 mm  por 5.000",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:3565.57,minStock:5,dailyUsage:0.5,category:"Rellenos y Coberturas",brand:"Ledevit",history:gh(180,0.5)},
  {id:240,name:"Mix Cupcake vainilla 500 grs. (6 kgs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:233.61,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:241,name:"Mix Budín vainilla 500 grs. (6 kgs)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:213.11,minStock:5,dailyUsage:0.5,category:"Premezclas Horneables",brand:"Ledevit",history:gh(180,0.5)},
  {id:242,name:"Cobertura Premium 1,3 kgs.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:225.41,minStock:5,dailyUsage:0.5,category:"Salsas y Coberturas",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:243,name:"Mousse Chantilly 1 kg. (Ledevit)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:573.77,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:244,name:"Mousse Frutilla 1 kg. (Ledevit)",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:573.77,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:245,name:"Mousse Chocolate por 1 kg.",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:598.36,minStock:5,dailyUsage:0.5,category:"Premezclas Pasteleras",brand:"Ledevit",history:gh(180,0.5)},
  {id:246,name:"AROMATIZANTES  1 lt. Chocolate, Coco, Manteca, Frutilla, Queso,Banana,Panettone",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:245.9,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:247,name:"Aromatizante Naranja 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:248,name:"Aromatizante Limón 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:249,name:"Aromatizante Menta 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
  {id:250,name:"Aromatizante Banana 1 lt. (Duas Rodas)",barcode:"",supplierId:"arg",unit:"un",stock:0,unitCost:360.65,minStock:5,dailyUsage:0.5,category:"Aromatizantes",brand:"Duas Rodas",history:gh(180,0.5)},
];

const ALERT_CFG = {
  order_now:  {label:"Pedir YA",     dot:T.danger,  bg:T.dangerBg,bd:T.dangerBd,txt:T.danger, pri:3},
  order_soon: {label:"Pedir pronto", dot:T.warning, bg:T.warnBg,  bd:T.warnBd,  txt:T.warning,pri:2},
  watch:      {label:"Vigilar",      dot:T.watch,   bg:T.watchBg, bd:T.watchBd, txt:T.watch,  pri:1},
  ok:         {label:"Normal",       dot:T.ok,      bg:T.okBg,    bd:T.okBd,    txt:T.ok,     pri:0},
};

const fmtDate  = d=>d?new Date(d).toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtShort = d=>d?new Date(d).toLocaleDateString("es-UY",{day:"2-digit",month:"short"}):"—";

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const Cap = ({children,style:sx})=>(
  <span style={{fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:T.textSm,...sx}}>{children}</span>
);

const AlertPill = ({level})=>{
  const c=ALERT_CFG[level];
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,border:`1px solid ${c.bd}`,color:c.txt,fontFamily:T.sans,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",padding:"3px 9px",borderRadius:2}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,display:"inline-block",...(level==="order_now"?{animation:"pulseDot 1.8s ease infinite"}:{})}}/>
      {c.label}
    </span>
  );
};

const StockBar = ({stock,r,ss,max})=>{
  const m=max||Math.max(stock*1.6,r*2.5,1);
  const pct=v=>Math.min(100,Math.max(0,v/m*100));
  const col=stock<=r?T.danger:stock<=r*1.3?T.warning:T.green;
  return(
    <div style={{position:"relative",height:6,background:T.muted,width:"100%"}}>
      <div style={{position:"absolute",left:0,width:`${pct(ss)}%`,height:"100%",background:"#fecaca",opacity:.7}}/>
      <div style={{position:"absolute",left:`${pct(r)}%`,width:2,height:"160%",top:"-30%",background:T.warning,zIndex:2}}/>
      <div style={{position:"absolute",left:0,width:`${pct(stock)}%`,height:"100%",background:col,opacity:.75}}/>
    </div>
  );
};

const Spark = ({history,color=T.textXs})=>{
  if(!history?.length||history.length<2) return <span style={{fontSize:10,color:T.textXs}}>—</span>;
  const v=history.map(h=>h.consumed),mx=Math.max(...v),mn=Math.min(...v),W=60,H=20;
  const pts=v.map((x,i)=>`${i/(v.length-1)*W},${H-((mx===mn?.5:(x-mn)/(mx-mn))*(H-3))-1.5}`).join(" ");
  return(<svg width={W} height={H}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity=".7"/>
    <circle cx={(v.length-1)/(v.length-1)*W} cy={H-((mx===mn?.5:(v[v.length-1]-mn)/(mx-mn))*(H-3))-1.5} r="2.5" fill={color}/></svg>);
};

// ─────────────────────────────────────────────────────────────────────────────
// FORM ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const inp={width:"100%",fontFamily:T.sans,fontSize:13,color:T.text,background:T.card,border:`1px solid ${T.border}`,padding:"9px 11px",borderRadius:4};
const Inp=({value,onChange,type="text",placeholder,min,step,style:sx,inputRef,onKeyDown,autoFocus})=>(
  <input ref={inputRef} type={type} value={value} onChange={onChange} placeholder={placeholder} min={min} step={step} onKeyDown={onKeyDown} autoFocus={autoFocus} style={{...inp,...sx}}/>
);
const Sel=({value,onChange,children,style:sx})=>(
  <select value={value} onChange={onChange} style={{...inp,cursor:"pointer",...sx}}>{children}</select>
);
const Field=({label,hint,children})=>(
  <div>
    <div style={{marginBottom:5}}><Cap>{label}</Cap></div>
    {children}
    {hint&&<p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:4,lineHeight:1.5}}>{hint}</p>}
  </div>
);

const Btn=({onClick,children,variant="primary",small,full,disabled})=>{
  const v={
    primary:{bg:T.green,cl:"#fff",bd:T.green},
    ghost:  {bg:"transparent",cl:T.textMd,bd:T.border},
    danger: {bg:"transparent",cl:T.danger,bd:T.dangerBd},
    success:{bg:"transparent",cl:T.ok,bd:T.okBd},
  }[variant]||{bg:T.green,cl:"#fff",bd:T.green};
  return(
    <button onClick={onClick} disabled={disabled}
      style={{background:v.bg,color:v.cl,border:`1px solid ${v.bd}`,fontFamily:T.sans,fontSize:small?11:12,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",padding:small?"6px 12px":"10px 22px",cursor:disabled?"default":"pointer",display:"inline-flex",alignItems:"center",gap:6,justifyContent:"center",width:full?"100%":"auto",opacity:disabled?.4:1,borderRadius:4,transition:"opacity .15s"}}>
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────────────────────
const Modal=({title,sub,onClose,children,wide})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(245,240,232,.9)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:20}}>
    <div className="au" style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,width:"100%",maxWidth:wide?840:540,maxHeight:"94vh",overflowY:"auto",boxShadow:"0 16px 60px rgba(0,0,0,.1)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"24px 28px 16px",borderBottom:`1px solid ${T.border}`}}>
        <div>
          {sub&&<Cap style={{color:T.green}}>{sub}</Cap>}
          <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginTop:sub?4:0,letterSpacing:"-.01em"}}>{title}</h2>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.textXs,fontSize:22,lineHeight:1,padding:4,marginTop:2}}>×</button>
      </div>
      <div style={{padding:"22px 28px 28px"}}>{children}</div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT FORM
// ─────────────────────────────────────────────────────────────────────────────
const ProductForm=({product,suppliers,onSave,onClose})=>{
  const blank={name:"",barcode:"",supplierId:"arg",unit:"kg",stock:0,unitCost:0,history:[]};
  const [f,setF]=useState(product?{...product}:blank);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const [csv,setCsv]=useState(product?.history?.map(h=>`${h.month},${h.consumed}`).join("\n")||"");
  const bRef=useRef();
  const parseCSV=()=>{
    try{
      const rows=csv.trim().split("\n").map(r=>{const[m,c]=r.split(",");return{month:m?.trim(),consumed:+c?.trim()};}).filter(r=>r.month&&!isNaN(r.consumed)&&r.consumed>0);
      if(!rows.length){alert("No se encontraron datos válidos.");return;}
      setF(p=>({...p,history:rows}));
    }catch{alert("Formato incorrecto. Usar: YYYY-MM,cantidad");}
  };
  const sup=suppliers.find(s=>s.id===f.supplierId);
  const lead=sup?totalLead(sup):0;
  const r=f.history.length?rop(f.history,lead):null;
  const ss=f.history.length?safetyStock(f.history,lead):null;
  const eq=f.history.length&&f.unitCost?eoq(f.history,f.unitCost):null;
  return(
    <div style={{display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Field label="Nombre del producto"><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Harina 000"/></Field>
        <Field label="Código de barras (EAN)">
          <div style={{display:"flex",gap:6}}>
            <Inp inputRef={bRef} value={f.barcode} onChange={e=>set("barcode",e.target.value)} placeholder="Escanear o tipear"/>
            <button onClick={()=>bRef.current?.focus()} style={{border:`1px solid ${T.border}`,background:T.muted,padding:"0 10px",cursor:"pointer",fontSize:15,color:T.textSm,borderRadius:4}} title="Foco para scanner">▦</button>
          </div>
        </Field>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        <Field label="Proveedor / Origen">
          <Sel value={f.supplierId} onChange={e=>set("supplierId",e.target.value)}>
            {suppliers.map(s=><option key={s.id} value={s.id}>[{s.flag}] {s.name} — {totalLead(s)}d</option>)}
          </Sel>
        </Field>
        <Field label="Unidad"><Inp value={f.unit} onChange={e=>set("unit",e.target.value)} placeholder="kg, lt, u..."/></Field>
        <Field label="Costo unitario (USD)"><Inp type="number" step="0.01" value={f.unitCost} onChange={e=>set("unitCost",+e.target.value)}/></Field>
      </div>
      <Field label="Stock actual"><Inp type="number" value={f.stock} onChange={e=>set("stock",+e.target.value)}/></Field>
      {r!==null&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[{l:"Punto de pedido (ROP)",v:`${r} ${f.unit}`,h:"Pedir cuando llegue a este nivel"},{l:"Stock de seguridad",v:`${ss} ${f.unit}`,h:"Buffer 95% nivel de servicio"},{l:"Cantidad óptima (EOQ)",v:eq?`${eq} ${f.unit}`:"—",h:"Minimiza costos"}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"12px 14px"}}>
              <Cap>{s.l}</Cap>
              <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.text,margin:"4px 0 2px"}}>{s.v}</div>
              <p style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>{s.h}</p>
            </div>
          ))}
        </div>
      )}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <Field label="Historial de consumo mensual" hint="Pegá desde Excel: YYYY-MM,cantidad — una línea por mes. Más historial = cálculos más precisos.">
          <textarea value={csv} onChange={e=>setCsv(e.target.value)} placeholder={"2024-09,410\n2024-10,420\n2024-11,380\n2024-12,460\n2025-01,410\n2025-02,430"}
            style={{width:"100%",height:90,fontFamily:"monospace",fontSize:12,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4,marginTop:5}}/>
          <div style={{display:"flex",gap:10,marginTop:8,alignItems:"center"}}>
            <Btn onClick={parseCSV} variant="ghost" small>Importar historial</Btn>
            {f.history.length>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>✓ {f.history.length} meses · prom. {Math.round(f.history.reduce((s,h)=>s+h.consumed,0)/f.history.length)} {f.unit}/mes</span>}
          </div>
        </Field>
      </div>
      <div style={{display:"flex",gap:10,paddingTop:4}}>
        <Btn onClick={()=>onSave(f)} full>{product?"Guardar cambios":"Agregar producto"}</Btn>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ORDER MODAL
// ─────────────────────────────────────────────────────────────────────────────
const OrderModal=({product,supplier,onConfirm,onClose})=>{
  const lead=totalLead(supplier);
  const daily=avgDaily(product.history);
  const r=rop(product.history,lead);
  const ss=safetyStock(product.history,lead);
  const eq=eoq(product.history,product.unitCost);
  const {level,daysToROP,daysOut}=alertLevel(product,supplier);
  const [qty,setQty]=useState(eq||Math.ceil(daily*lead*1.5));
  const [useEOQ,setUseEOQ]=useState(true);
  useEffect(()=>{if(useEOQ)setQty(eq||Math.ceil(daily*lead*1.5));},[useEOQ]);
  const arrival=new Date();arrival.setDate(arrival.getDate()+lead);
  const stockAfter=product.stock+qty;
  const daysAfter=daily>0?Math.round(stockAfter/daily):999;
  const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];
  const tfs=[{k:"preparation",l:"Preparación"},{k:"customs",l:"Aduana"},{k:"freight",l:"Flete"},{k:"warehouse",l:"Depósito"}];
  return(
    <Modal title={product.name} sub="Generar pedido de reabastecimiento" onClose={onClose} wide>
      <div style={{display:"grid",gap:20}}>
        {level!=="ok"&&(
          <div style={{background:ALERT_CFG[level].bg,border:`1px solid ${ALERT_CFG[level].bd}`,padding:"11px 14px",borderRadius:4,display:"flex",gap:10,alignItems:"center"}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:ALERT_CFG[level].dot,flexShrink:0,...(level==="order_now"?{animation:"pulseDot 1.8s ease infinite"}:{})}}/>
            <span style={{fontFamily:T.sans,fontSize:12,color:ALERT_CFG[level].txt,fontWeight:600}}>
              {level==="order_now"?`Stock bajo el punto de pedido — quedan aprox. ${daysOut} días de existencia`:`El stock alcanza el punto de pedido en ${daysToROP} días — pedí antes del ${fmtShort(new Date(Date.now()+daysToROP*864e5))}`}
            </span>
          </div>
        )}
        {/* 4 metrics */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[{l:"Stock actual",v:`${product.stock} ${product.unit}`},{l:"Punto de pedido",v:`${r} ${product.unit}`,sub:"ROP"},{l:"Stock de seguridad",v:`${ss} ${product.unit}`,sub:"Safety"},{l:"Días restantes",v:`${daysOut<999?daysOut+"d":"∞"}`,c:daysOut<=lead?T.danger:T.text}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"13px 15px"}}>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <Cap>{s.l}</Cap>
                {s.sub&&<Cap style={{color:T.green,fontSize:9}}>{s.sub}</Cap>}
              </div>
              <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:s.c||T.text,marginTop:4}}>{s.v}</div>
            </div>
          ))}
        </div>
        {/* Stock bar */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:6}}>
            <Cap>Nivel de stock visual</Cap>
            <div style={{display:"flex",gap:12}}>
              {[["#fecaca","Stock seguridad"],[T.warning+"99","Punto de pedido"],[T.green+"99","Stock actual"]].map(([c,l])=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:4,fontFamily:T.sans,fontSize:10,color:T.textSm}}>
                  <span style={{width:10,height:6,background:c,borderRadius:1,display:"inline-block"}}/>{l}
                </span>
              ))}
            </div>
          </div>
          <StockBar stock={product.stock} r={r} ss={ss} max={Math.max(product.stock*1.6,r*2.5)}/>
        </div>
        {/* Timeline */}
        <div style={{background:T.cardWarm,borderRadius:6,padding:16,border:`1px solid ${T.border}`}}>
          <Cap>Timeline de entrega completo</Cap>
          <div style={{display:"flex",gap:2,marginTop:10,height:10,borderRadius:3,overflow:"hidden"}}>
            {tfs.map((tf,i)=><div key={tf.k} style={{flex:supplier.times[tf.k]||.1,background:tfCols[i]}} title={`${tf.l}: ${supplier.times[tf.k]}d`}/>)}
          </div>
          <div style={{display:"flex",gap:2,marginTop:7}}>
            {tfs.map((tf,i)=>(
              <div key={tf.k} style={{flex:supplier.times[tf.k]||.1}}>
                <div style={{fontFamily:T.sans,fontSize:9,fontWeight:700,color:tfCols[i]}}>{tf.l}</div>
                <div style={{fontFamily:T.sans,fontSize:9,color:T.textXs}}>{supplier.times[tf.k]}d</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <Cap>Llegada estimada</Cap>
            <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.green}}>{fmtDate(arrival)}</div>
          </div>
        </div>
        {/* Qty */}
        <div>
          <Cap>Cantidad a pedir</Cap>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:10}}>
            <div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[{id:true,label:`EOQ — ${eq} ${product.unit}`,hint:"Óptimo por costo"},{id:false,label:"Manual",hint:"Ingresar cantidad"}].map(opt=>(
                  <button key={String(opt.id)} onClick={()=>setUseEOQ(opt.id)}
                    style={{flex:1,padding:"10px 12px",border:`1px solid ${useEOQ===opt.id?T.green:T.border}`,background:useEOQ===opt.id?T.greenBg:T.card,cursor:"pointer",textAlign:"left",borderRadius:4}}>
                    <div style={{fontFamily:T.sans,fontSize:11,fontWeight:600,color:useEOQ===opt.id?T.green:T.textMd}}>{opt.label}</div>
                    <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>{opt.hint}</div>
                  </button>
                ))}
              </div>
              {!useEOQ&&<Inp type="number" value={qty} onChange={e=>setQty(Math.max(0,+e.target.value))} placeholder={`Cantidad en ${product.unit}`}/>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
              {[{l:"Cantidad",v:`${qty} ${product.unit}`},{l:"Costo total",v:`USD ${(qty*product.unitCost).toFixed(2)}`},{l:"Stock después",v:`${stockAfter} ${product.unit}`},{l:"Días de stock",v:`${daysAfter<999?daysAfter:999}d`}].map((s,i)=>(
                <div key={i} style={{background:T.cardWarm,padding:"10px 12px"}}>
                  <Cap>{s.l}</Cap>
                  <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text,marginTop:2}}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>onConfirm(qty)} full>Confirmar pedido · {qty} {product.unit} · USD {(qty*product.unitCost).toFixed(2)}</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL IMPORT
// ─────────────────────────────────────────────────────────────────────────────
const ExcelModal=({products,onApply,onClose})=>{
  const [text,setText]=useState("");
  const [headers,setHeaders]=useState([]);
  const [rows,setRows]=useState([]);
  const [cols,setCols]=useState({code:"",name:"",stock:""});
  const [preview,setPreview]=useState([]);

  useEffect(()=>{
    if(!text.trim())return;
    const lines=text.trim().split("\n").filter(Boolean);
    if(lines.length<2)return;
    const sep=lines[0].includes("\t")?"\t":",";
    const hdrs=lines[0].split(sep).map(h=>h.trim().replace(/"/g,""));
    const data=lines.slice(1).map(l=>{const cells=l.split(sep).map(c=>c.trim().replace(/"/g,""));const o={};hdrs.forEach((h,i)=>o[h]=cells[i]||"");return o;});
    setHeaders(hdrs);setRows(data);
    const g=cs=>hdrs.find(h=>cs.some(c=>h.toLowerCase().includes(c)))||"";
    setCols({code:g(["codigo","código","cod","ean","barcode"]),name:g(["nombre","descripcion","descripción","producto","articulo","artículo"]),stock:g(["stock","cantidad","existencia","saldo","disponible"])});
  },[text]);

  useEffect(()=>{
    if(!rows.length||!cols.stock){setPreview([]);return;}
    const m=[];
    rows.forEach(row=>{
      const cv=cols.code?row[cols.code]:"",nv=cols.name?row[cols.name]:"",sv=parseFloat(row[cols.stock]);
      if(isNaN(sv))return;
      const p=products.find(p=>(cv&&p.barcode&&(p.barcode===cv||p.barcode===cv.replace(/\D/g,"")))||(nv&&p.name.toLowerCase().includes(nv.toLowerCase().slice(0,5))));
      if(p)m.push({product:p,newStock:Math.round(sv)});
    });
    setPreview(m);
  },[rows,cols]);

  return(
    <Modal title="Actualizar stock desde Excel" sub="Importar desde Mercado" onClose={onClose} wide>
      <div style={{display:"grid",gap:16}}>
        <div style={{background:T.watchBg,borderLeft:`3px solid ${T.watch}`,padding:"12px 14px",borderRadius:4}}>
          <p style={{fontFamily:T.sans,fontSize:12,color:"#1e40af",lineHeight:1.6}}>
            <strong>Desde Mercado:</strong> Listado de stock → Exportar → Excel/CSV → seleccioná todo (Ctrl+A) → copiá (Ctrl+C) → pegá abajo.
          </p>
        </div>
        <Field label="Pegá el contenido del Excel aquí (Ctrl+V)">
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={"Código\tNombre\tStock disponible\n7790895000123\tHarina 000\t150"}
            style={{width:"100%",height:100,fontFamily:"monospace",fontSize:11,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4}}/>
        </Field>
        {headers.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[{k:"code",l:"Columna código"},{k:"name",l:"Columna nombre"},{k:"stock",l:"Columna stock ★"}].map(cf=>(
              <Field key={cf.k} label={cf.l}>
                <Sel value={cols[cf.k]} onChange={e=>setCols(c=>({...c,[cf.k]:e.target.value}))}>
                  <option value="">— no usar —</option>
                  {headers.map(h=><option key={h} value={h}>{h}</option>)}
                </Sel>
              </Field>
            ))}
          </div>
        )}
        {preview.length>0&&(
          <div>
            <Cap>{preview.length} productos encontrados</Cap>
            <div style={{border:`1px solid ${T.border}`,borderRadius:4,marginTop:8,maxHeight:180,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted}}>
                  {["Producto","Stock actual","Nuevo stock","Δ"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,borderBottom:`1px solid ${T.border}`}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {preview.map((r,i)=>{const diff=r.newStock-r.product.stock;return(
                    <tr key={i} style={{borderBottom:`1px solid ${T.border}`}}>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,fontWeight:500}}>{r.product.name}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,color:T.textSm}}>{r.product.stock} {r.product.unit}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:13,fontWeight:600}}>{r.newStock} {r.product.unit}</td>
                      <td style={{padding:"8px 12px",fontFamily:T.sans,fontSize:12,fontWeight:700,color:diff>=0?T.ok:T.danger}}>{diff>=0?"+":""}{diff}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>preview.length&&onApply(preview)} full disabled={!preview.length}>Aplicar actualización ({preview.length} productos)</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA SCANNER  (ZXing — Google barcode library)
// ─────────────────────────────────────────────────────────────────────────────
const CameraScanner = ({ onDetected, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const readerRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | error
  const [errorMsg, setErrorMsg] = useState("");
  const [lastScan, setLastScan] = useState("");
  const lastScanRef = useRef(""); // prevent duplicate fires

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        // Load ZXing dynamically from CDN
        if (!window.ZXing) {
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/zxing-js/0.21.3/zxing.min.js";
            s.onload = resolve;
            s.onerror = () => reject(new Error("No se pudo cargar la librería de escaneo"));
            document.head.appendChild(s);
          });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const hints = new Map();
        hints.set(2, [1, 2, 3, 4, 5, 6, 7, 8, 13, 14]); // all barcode formats

        const codeReader = new window.ZXing.BrowserMultiFormatReader(hints);
        readerRef.current = codeReader;
        setStatus("scanning");

        codeReader.decodeFromVideoElement(videoRef.current, (result, err) => {
          if (cancelled) return;
          if (result) {
            const text = result.getText();
            // Debounce — ignore same code within 2 seconds
            if (text === lastScanRef.current) return;
            lastScanRef.current = text;
            setLastScan(text);
            setTimeout(() => { lastScanRef.current = ""; }, 2000);
            onDetected(text);
          }
        });

      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          if (e.name === "NotAllowedError") setErrorMsg("Permiso de cámara denegado. Habilitá el acceso en la configuración del navegador.");
          else if (e.name === "NotFoundError") setErrorMsg("No se encontró cámara en este dispositivo.");
          else setErrorMsg(e.message || "Error al acceder a la cámara.");
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      readerRef.current?.reset?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.92)", zIndex: 1100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent)" }}>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 20, color: "#fff", fontWeight: 500 }}>Escaneando con cámara</div>
          <div style={{ fontFamily: T.sans, fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 2 }}>Apuntá al código de barras del producto</div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 6, color: "#fff", padding: "8px 14px", cursor: "pointer", fontFamily: T.sans, fontSize: 12, fontWeight: 600 }}>Cerrar</button>
      </div>

      {/* Video */}
      <div style={{ position: "relative", width: "100%", maxWidth: 480, aspectRatio: "4/3" }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4, display: status === "error" ? "none" : "block" }}/>

        {/* Scan frame overlay */}
        {status === "scanning" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            {/* Dimmed corners */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)" }}/>
            {/* Clear scan zone */}
            <div style={{ position: "relative", width: "72%", height: "35%", zIndex: 1 }}>
              <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,.0)", background: "transparent" }}/>
              {/* Corner brackets */}
              {[["top:0,left:0","borderTop,borderLeft"],["top:0,right:0","borderTop,borderRight"],["bottom:0,left:0","borderBottom,borderLeft"],["bottom:0,right:0","borderBottom,borderRight"]].map(([pos, borders], i) => {
                const p = Object.fromEntries(pos.split(",").map(s => s.split(":")));
                const b = Object.fromEntries(borders.split(",").map(s => [s, `3px solid ${T.green}`]));
                return <div key={i} style={{ position: "absolute", width: 22, height: 22, ...p, ...b }}/>;
              })}
              {/* Scan line animation */}
              <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${T.green}, transparent)`, animation: "scanLine 2s ease-in-out infinite" }}/>
            </div>
          </div>
        )}

        {/* Starting overlay */}
        {status === "starting" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.7)", borderRadius: 4 }}>
            <div style={{ width: 36, height: 36, border: `3px solid ${T.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
            <p style={{ fontFamily: T.sans, fontSize: 13, color: "#fff", marginTop: 14 }}>Iniciando cámara...</p>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>📷</div>
            <p style={{ fontFamily: T.sans, fontSize: 14, color: "#fff", fontWeight: 600, marginBottom: 8 }}>No se pudo acceder a la cámara</p>
            <p style={{ fontFamily: T.sans, fontSize: 12, color: "rgba(255,255,255,.6)", lineHeight: 1.6 }}>{errorMsg}</p>
            <button onClick={onClose} style={{ marginTop: 20, background: T.green, border: "none", color: "#fff", padding: "10px 24px", borderRadius: 4, fontFamily: T.sans, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Volver al scanner manual</button>
          </div>
        )}
      </div>

      {/* Last scan feedback */}
      {lastScan && (
        <div style={{ marginTop: 16, background: T.greenBg, border: `1px solid ${T.greenBd}`, borderRadius: 6, padding: "10px 20px", textAlign: "center" }}>
          <p style={{ fontFamily: T.sans, fontSize: 12, color: T.green, fontWeight: 600 }}>Código detectado: {lastScan}</p>
        </div>
      )}

      <p style={{ fontFamily: T.sans, fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 20, textAlign: "center", padding: "0 24px" }}>
        Funciona con códigos EAN-8, EAN-13, UPC, QR y más · Usá cámara trasera para mejores resultados
      </p>

      <style>{`
        @keyframes scanLine { 0%,100%{top:0;opacity:0;} 10%{opacity:1;} 90%{opacity:1;} 50%{top:calc(100% - 2px);} }
        @keyframes spin { to{transform:rotate(360deg);} }
      `}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SCANNER  (USB lector + Cámara del celular)
// ─────────────────────────────────────────────────────────────────────────────
const Scanner=({products,suppliers,onUpdate})=>{
  const [mode, setMode] = useState("usb"); // "usb" | "camera"
  const [val,setVal]=useState("");
  const [found,setFound]=useState(null);
  const [qty,setQty]=useState(1);
  const [log,setLog]=useState([]);
  const [msg,setMsg]=useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const ref=useRef();

  useEffect(()=>{ if(mode==="usb") setTimeout(()=>ref.current?.focus(),80); },[mode]);

  const flash=(ok,text)=>{setMsg({ok,text});setTimeout(()=>setMsg(null),3500);};

  const processCode = (code) => {
    const q = code.trim().toLowerCase();
    const p = products.find(x => x.barcode === code.trim() || x.name.toLowerCase().includes(q));
    if(p){ setFound(p); setQty(1); flash(true,`Encontrado: ${p.name}`); }
    else { setFound(null); flash(false,`"${code}" no encontrado en el sistema`); }
  };

  const handleKey=e=>{
    if(e.key!=="Enter"||!val.trim())return;
    processCode(val);
    setVal("");
  };

  const handleCameraDetect = (code) => {
    setShowCamera(false);
    processCode(code);
  };

  const confirm=()=>{
    if(!found)return;
    onUpdate(found.id,qty);
    setLog(l=>[{time:new Date().toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"}),name:found.name,qty,unit:found.unit},...l.slice(0,19)]);
    flash(true,`+${qty} ${found.unit} ingresado para ${found.name}`);
    setFound(null);setQty(1);
    if(mode==="usb") setTimeout(()=>ref.current?.focus(),80);
  };

  const fa=found?alertLevel(found,suppliers.find(s=>s.id===found.supplierId)):null;

  return(
    <div style={{maxWidth:600}}>
      {showCamera && <CameraScanner onDetected={handleCameraDetect} onClose={()=>setShowCamera(false)}/>}

      <div style={{marginBottom:24}}>
        <Cap style={{color:T.green}}>Herramienta</Cap>
        <h1 style={{fontFamily:T.serif,fontSize:38,fontWeight:500,color:T.text,marginTop:6,letterSpacing:"-.02em"}}>Scanner</h1>
        <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm,marginTop:6,lineHeight:1.6}}>
          Escaneá productos con el lector USB/Bluetooth o con la cámara de tu celular.
        </p>
      </div>

      {/* Mode selector */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border,borderRadius:8,overflow:"hidden",marginBottom:16}}>
        {[
          {id:"usb",   icon:"⌨️", title:"Lector USB / Bluetooth", sub:"Lector físico conectado a la PC"},
          {id:"camera",icon:"📷", title:"Cámara del celular",     sub:"Usá la cámara para escanear"},
        ].map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)}
            style={{background:mode===m.id?T.greenBg:T.card,border:"none",padding:"16px 18px",cursor:"pointer",textAlign:"left",borderBottom:mode===m.id?`2px solid ${T.green}`:"2px solid transparent"}}>
            <div style={{fontSize:20,marginBottom:6}}>{m.icon}</div>
            <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:mode===m.id?T.green:T.textMd}}>{m.title}</div>
            <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:2}}>{m.sub}</div>
          </button>
        ))}
      </div>

      {/* USB mode */}
      {mode==="usb"&&(
        <div style={{border:`2px dashed ${T.border}`,borderRadius:8,padding:"18px 20px",marginBottom:14,background:T.card}}>
          <Cap>Campo de escaneo — click aquí antes de escanear</Cap>
          <Inp inputRef={ref} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={handleKey}
            placeholder="Esperando escaneo o buscá por nombre..." autoFocus
            style={{fontSize:16,letterSpacing:"0.04em",marginTop:8}}/>
          <p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:5}}>El lector envía Enter automáticamente al escanear.</p>
        </div>
      )}

      {/* Camera mode */}
      {mode==="camera"&&(
        <div style={{marginBottom:14}}>
          <button onClick={()=>setShowCamera(true)}
            style={{width:"100%",background:T.green,border:"none",borderRadius:8,padding:"20px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
            <span style={{fontSize:40}}>📷</span>
            <div style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:"#fff"}}>Abrir cámara</div>
            <div style={{fontFamily:T.sans,fontSize:12,color:"rgba(255,255,255,.75)"}}>
              Funciona desde el celular · Chrome y Safari · Sin instalar nada
            </div>
          </button>
          <div style={{marginTop:10,background:T.watchBg,border:`1px solid ${T.watchBd}`,borderRadius:6,padding:"10px 14px"}}>
            <p style={{fontFamily:T.sans,fontSize:11,color:T.watch,lineHeight:1.6}}>
              <strong>Tip:</strong> Para mejores resultados, abrí esta página desde el navegador de tu celular. El sistema pedirá permiso para usar la cámara la primera vez.
            </p>
          </div>
          {/* Also keep manual input as fallback */}
          <div style={{marginTop:10,border:`1px dashed ${T.border}`,borderRadius:6,padding:"12px 14px",background:T.card}}>
            <Cap style={{color:T.textXs}}>O ingresá el código manualmente</Cap>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <Inp value={val} onChange={e=>setVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&val.trim()){processCode(val);setVal("");}}}
                placeholder="Tipear código EAN..." style={{fontSize:14}}/>
              <Btn onClick={()=>{if(val.trim()){processCode(val);setVal("");}}} small>Buscar</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Feedback */}
      {msg&&<div className="au" style={{padding:"10px 14px",marginBottom:12,background:msg.ok?T.okBg:T.dangerBg,borderLeft:`3px solid ${msg.ok?T.ok:T.danger}`,borderRadius:4}}><p style={{fontFamily:T.sans,fontSize:13,color:msg.ok?T.ok:T.danger,fontWeight:500}}>{msg.text}</p></div>}

      {/* Found product */}
      {found&&fa&&(
        <div className="au" style={{border:`1px solid ${T.border}`,borderRadius:8,marginBottom:14,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"15px 18px",borderBottom:`1px solid ${T.border}`,background:T.cardWarm}}>
            <div>
              <Cap style={{color:T.green}}>Producto encontrado</Cap>
              <h3 style={{fontFamily:T.serif,fontSize:24,fontWeight:500,color:T.text,marginTop:3}}>{found.name}</h3>
              <p style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>EAN: {found.barcode}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <Cap>Stock actual</Cap>
              <div style={{fontFamily:T.serif,fontSize:28,fontWeight:400,marginTop:3,color:fa.level==="order_now"?T.danger:fa.level==="order_soon"?T.warning:T.text}}>
                {found.stock} <span style={{fontSize:14,color:T.textSm}}>{found.unit}</span>
              </div>
              <div style={{marginTop:6}}><AlertPill level={fa.level}/></div>
            </div>
          </div>
          {fa.rop>0&&<div style={{padding:"10px 18px",borderBottom:`1px solid ${T.border}`}}>
            <StockBar stock={found.stock} r={fa.rop} ss={fa.ss} max={Math.max(found.stock*1.6,fa.rop*2.5)}/>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>Seg.: {fa.ss} {found.unit}</span>
              <span style={{fontFamily:T.sans,fontSize:10,color:T.warning,fontWeight:600}}>ROP: {fa.rop} {found.unit}</span>
            </div>
          </div>}
          <div style={{display:"flex",gap:10,padding:"13px 18px",alignItems:"flex-end"}}>
            <div style={{flex:1}}>
              <Field label={`Cantidad a ingresar (${found.unit})`}>
                <Inp type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,+e.target.value))} style={{marginTop:5}}/>
              </Field>
            </div>
            <Btn onClick={confirm}>Confirmar ingreso</Btn>
          </div>
        </div>
      )}

      {/* Log */}
      {log.length>0&&(
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          <div style={{padding:"11px 16px",background:T.muted,borderBottom:`1px solid ${T.border}`}}><Cap>Registro de sesión</Cap></div>
          {log.map((l,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:i<log.length-1?`1px solid ${T.border}`:"none",background:i===0?T.cardWarm:T.card}}>
              <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs,minWidth:40}}>{l.time}</span>
              <span style={{fontFamily:T.sans,fontSize:13,fontWeight:500,flex:1,paddingLeft:12}}>{l.name}</span>
              <span style={{fontFamily:T.sans,fontSize:13,color:T.ok,fontWeight:600}}>+{l.qty} {l.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER RATING STARS
// ─────────────────────────────────────────────────────────────────────────────
const Stars = ({ value, onChange }) => (
  <div style={{display:"flex",gap:3}}>
    {[1,2,3,4,5].map(n => (
      <button key={n} onClick={()=>onChange&&onChange(n)}
        style={{background:"none",border:"none",cursor:onChange?"pointer":"default",
          fontSize:16,color:n<=value?"#f59e0b":"#ddd6cb",padding:"0 1px",lineHeight:1}}>★</button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────
const SupplierForm = ({ supplier, onSave, onClose }) => {
  const blank = {
    id: Date.now().toString(), name:"", flag:"", color:"#1d4ed8",
    times:{preparation:2,customs:2,freight:7,warehouse:1},
    company:"", contact:"", email:"", phone:"", whatsapp:"",
    country:"", city:"", currency:"USD", paymentTerms:"30",
    paymentMethod:"", minOrder:"0", discount:"0",
    rating:3, active:true, notes:"",
  };
  const [f, setF] = useState(supplier ? {...supplier} : blank);
  const set = (k,v) => setF(p => ({...p,[k]:v}));
  const setTime = (k,v) => setF(p => ({...p,times:{...p.times,[k]:Math.max(0,+v)}}));
  const tfCols = ["#3b82f6","#ef4444","#f59e0b","#10b981"];
  const tfs = [["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]];
  return (
    <div style={{display:"grid",gap:18}}>
      {/* Identity */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 80px",gap:12}}>
        <Field label="Nombre / Región"><Inp value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Argentina"/></Field>
        <Field label="Empresa proveedora"><Inp value={f.company} onChange={e=>set("company",e.target.value)} placeholder="Nombre legal"/></Field>
        <Field label="País (2 letras)"><Inp value={f.flag} onChange={e=>set("flag",e.target.value.toUpperCase().slice(0,2))} placeholder="AR"/></Field>
      </div>

      {/* Contact */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <div style={{marginBottom:10}}><Cap style={{color:T.green}}>Contacto</Cap></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Nombre del contacto"><Inp value={f.contact} onChange={e=>set("contact",e.target.value)} placeholder="Nombre y apellido"/></Field>
          <Field label="Email"><Inp type="email" value={f.email} onChange={e=>set("email",e.target.value)} placeholder="contacto@empresa.com"/></Field>
          <Field label="Teléfono"><Inp value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="+54 11 1234-5678"/></Field>
          <Field label="WhatsApp"><Inp value={f.whatsapp} onChange={e=>set("whatsapp",e.target.value)} placeholder="+54 9 11 1234-5678"/></Field>
        </div>
      </div>

      {/* Commercial conditions */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <div style={{marginBottom:10}}><Cap style={{color:T.green}}>Condiciones comerciales</Cap></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
          <Field label="Moneda">
            <Sel value={f.currency} onChange={e=>set("currency",e.target.value)}>
              {["USD","EUR","ARS","BRL"].map(c=><option key={c} value={c}>{c}</option>)}
            </Sel>
          </Field>
          <Field label="Plazo de pago (días)"><Inp type="number" value={f.paymentTerms} onChange={e=>set("paymentTerms",e.target.value)} placeholder="30"/></Field>
          <Field label="Pedido mínimo"><Inp type="number" value={f.minOrder} onChange={e=>set("minOrder",e.target.value)} placeholder="USD"/></Field>
          <Field label="Descuento (%)"><Inp type="number" value={f.discount} onChange={e=>set("discount",e.target.value)} placeholder="0"/></Field>
        </div>
        <div style={{marginTop:12}}>
          <Field label="Forma de pago"><Inp value={f.paymentMethod} onChange={e=>set("paymentMethod",e.target.value)} placeholder="Ej: Transferencia bancaria, Carta de crédito..."/></Field>
        </div>
      </div>

      {/* Lead times */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <Cap style={{color:T.green}}>Tiempos de entrega (días)</Cap>
          <Cap>Total: {Object.values(f.times).reduce((a,b)=>a+b,0)} días</Cap>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          {tfs.map(([k,l],i)=>(
            <Field key={k} label={l}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginTop:4}}>
                <Inp type="number" min="0" value={f.times[k]} onChange={e=>setTime(k,e.target.value)} style={{textAlign:"center"}}/>
                <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>d</span>
              </div>
            </Field>
          ))}
        </div>
        <div style={{display:"flex",gap:2,height:6,borderRadius:3,overflow:"hidden",marginTop:10}}>
          {tfs.map(([k],i)=><div key={k} style={{flex:f.times[k]||0.1,background:tfCols[i],opacity:.7}}/>)}
        </div>
      </div>

      {/* Rating & Notes */}
      <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14,display:"grid",gridTemplateColumns:"auto 1fr",gap:20,alignItems:"start"}}>
        <Field label="Calificación">
          <div style={{marginTop:6}}><Stars value={f.rating} onChange={v=>set("rating",v)}/></div>
        </Field>
        <Field label="Notas internas">
          <textarea value={f.notes} onChange={e=>set("notes",e.target.value)}
            placeholder="Condiciones especiales, observaciones, historia con el proveedor..."
            style={{width:"100%",height:70,fontFamily:T.sans,fontSize:12,color:T.text,background:T.muted,border:`1px solid ${T.border}`,padding:"9px 11px",resize:"vertical",borderRadius:4,marginTop:4}}/>
        </Field>
      </div>

      <div style={{display:"flex",gap:10}}>
        <Btn onClick={()=>onSave(f)} full>{supplier?"Guardar cambios":"Agregar proveedor"}</Btn>
        <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
const SupplierDetail = ({ supplier, products, orders, onEdit, onClose }) => {
  const tfCols = ["#3b82f6","#ef4444","#f59e0b","#10b981"];
  const tfs = [["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]];
  const supProducts = products.filter(p=>p.supplierId===supplier.id);
  const supOrders = orders.filter(o=>o.supplierId===supplier.id).slice(0,8);
  const pendingOrders = supOrders.filter(o=>o.status==="pending");
  const totalSpent = supOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(+o.totalCost||0),0);

  return (
    <Modal title={supplier.name} sub={supplier.company||"Proveedor"} onClose={onClose} wide>
      <div style={{display:"grid",gap:20}}>

        {/* Stats row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:6,overflow:"hidden"}}>
          {[
            {l:"Productos",   v:supProducts.length},
            {l:"Pedidos activos", v:pendingOrders.length, c:pendingOrders.length>0?T.watch:T.text},
            {l:"Total comprado",  v:`${supplier.currency||"USD"} ${totalSpent.toFixed(0)}`},
            {l:"Lead time",       v:`${totalLead(supplier)} días`},
          ].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,padding:"14px 16px"}}>
              <Cap>{s.l}</Cap>
              <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:s.c||T.text,marginTop:4}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          {/* Contact card */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:6,padding:16}}>
            <Cap style={{color:T.green}}>Contacto</Cap>
            <div style={{marginTop:10,display:"grid",gap:8}}>
              {[
                {icon:"👤",label:"Contacto",val:supplier.contact},
                {icon:"✉️",label:"Email",val:supplier.email,href:`mailto:${supplier.email}`},
                {icon:"📞",label:"Teléfono",val:supplier.phone,href:`tel:${supplier.phone}`},
                {icon:"💬",label:"WhatsApp",val:supplier.whatsapp,href:supplier.whatsapp?`https://wa.me/${supplier.whatsapp.replace(/\D/g,"")}`:""},
                {icon:"📍",label:"Ubicación",val:[supplier.city,supplier.country].filter(Boolean).join(", ")},
              ].filter(r=>r.val).map((r,i)=>(
                <div key={i} style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:14,width:20,textAlign:"center"}}>{r.icon}</span>
                  <div>
                    <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs,textTransform:"uppercase",letterSpacing:"0.1em"}}>{r.label}</div>
                    {r.href
                      ? <a href={r.href} target="_blank" rel="noreferrer" style={{fontFamily:T.sans,fontSize:13,color:T.green,textDecoration:"none",fontWeight:500}}>{r.val}</a>
                      : <div style={{fontFamily:T.sans,fontSize:13,color:T.text,fontWeight:500}}>{r.val}</div>
                    }
                  </div>
                </div>
              ))}
              <div style={{paddingTop:8,borderTop:`1px solid ${T.border}`}}>
                <Stars value={supplier.rating||3}/>
              </div>
            </div>
          </div>

          {/* Commercial conditions */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:6,padding:16}}>
            <Cap style={{color:T.green}}>Condiciones comerciales</Cap>
            <div style={{marginTop:10,display:"grid",gap:8}}>
              {[
                {l:"Moneda",v:supplier.currency},
                {l:"Plazo de pago",v:`${supplier.paymentTerms||"—"} días`},
                {l:"Forma de pago",v:supplier.paymentMethod||"—"},
                {l:"Pedido mínimo",v:supplier.minOrder>0?`${supplier.currency||"USD"} ${supplier.minOrder}`:"Sin mínimo"},
                {l:"Descuento",v:supplier.discount>0?`${supplier.discount}% por volumen`:"Sin descuento"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:i<4?`1px solid ${T.muted}`:"none"}}>
                  <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{r.l}</span>
                  <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{r.v||r[1]||"—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lead time visual */}
        <div style={{background:T.cardWarm,borderRadius:6,padding:14,border:`1px solid ${T.border}`}}>
          <Cap>Desglose de tiempos de entrega</Cap>
          <div style={{display:"flex",gap:2,marginTop:10,height:10,borderRadius:3,overflow:"hidden"}}>
            {tfs.map(([k],i)=><div key={k} style={{flex:supplier.times[k]||0.1,background:tfCols[i]}}/>)}
          </div>
          <div style={{display:"flex",gap:2,marginTop:6}}>
            {tfs.map(([k,l],i)=>(
              <div key={k} style={{flex:supplier.times[k]||0.1}}>
                <div style={{fontFamily:T.sans,fontSize:9,fontWeight:700,color:tfCols[i]}}>{l}</div>
                <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,fontWeight:600}}>{supplier.times[k]}d</div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        {supplier.notes && (
          <div style={{background:T.warnBg,border:`1px solid ${T.warnBd}`,borderRadius:6,padding:"12px 14px"}}>
            <Cap>Notas internas</Cap>
            <p style={{fontFamily:T.sans,fontSize:13,color:T.textMd,marginTop:6,lineHeight:1.7}}>{supplier.notes}</p>
          </div>
        )}

        {/* Products from this supplier */}
        {supProducts.length>0 && (
          <div>
            <Cap>Productos de este proveedor</Cap>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:1,background:T.border,marginTop:8,borderRadius:6,overflow:"hidden"}}>
              {supProducts.map(p=>(
                <div key={p.id} style={{background:T.card,padding:"10px 12px"}}>
                  <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{p.name}</div>
                  <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>{p.stock} {p.unit} en stock</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order history */}
        {supOrders.length>0 && (
          <div>
            <Cap>Historial de pedidos recientes</Cap>
            <div style={{border:`1px solid ${T.border}`,borderRadius:6,marginTop:8,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted}}>
                  {["Producto","Cantidad","Costo","Pedido","Llegada","Estado"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {supOrders.map((o,i)=>(
                    <tr key={o.id} style={{borderBottom:i<supOrders.length-1?`1px solid ${T.border}`:"none",background:i%2===0?T.card:T.cardWarm}}>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:13,fontWeight:500}}>{o.productName}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:13}}>{o.qty} {o.unit}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:13}}>{supplier.currency||"USD"} {o.totalCost}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{new Date(o.orderedAt).toLocaleDateString("es-UY",{day:"2-digit",month:"short"})}</td>
                      <td style={{padding:"9px 12px",fontFamily:T.sans,fontSize:12,color:o.status==="pending"?T.watch:T.ok}}>{new Date(o.expectedArrival).toLocaleDateString("es-UY",{day:"2-digit",month:"short"})}</td>
                      <td style={{padding:"9px 12px"}}><AlertPill level={o.status==="pending"?"watch":"ok"}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:10,paddingTop:4}}>
          <Btn onClick={onEdit} full variant="ghost">✏️ Editar proveedor</Btn>
          <Btn onClick={onClose} variant="ghost">Cerrar</Btn>
        </div>
      </div>
    </Modal>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// PLANNING MODULE — Proyección 6 meses + temporadas + cuánto pedir
// ─────────────────────────────────────────────────────────────────────────────

// Months helper
const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const getNextMonths = (n=6) => {
  const out = [];
  const d = new Date();
  for(let i=0;i<n;i++){
    const m = new Date(d.getFullYear(), d.getMonth()+i, 1);
    out.push({ key: m.toISOString().slice(0,7), label: MONTHS_ES[m.getMonth()]+" "+m.getFullYear().toString().slice(2) });
  }
  return out;
};

const SEASON_PRESETS = [
  { id:"none",    label:"Sin ajuste",      mult:1.0 },
  { id:"low",     label:"Temporada baja",  mult:0.7 },
  { id:"normal",  label:"Normal",          mult:1.0 },
  { id:"high",    label:"Temporada alta",  mult:1.3 },
  { id:"peak",    label:"Pico (diciembre/SS)", mult:1.6 },
];

const SeasonBadge = ({ mult }) => {
  const cfg = mult >= 1.5 ? {c:"#92400e",bg:"#fffbeb",bd:"#fde68a",l:"Pico"} :
              mult >= 1.2 ? {c:"#166534",bg:"#f0fdf4",bd:"#bbf7d0",l:"Alta"} :
              mult <= 0.8 ? {c:"#1e40af",bg:"#eff6ff",bd:"#bfdbfe",l:"Baja"} :
                            {c:T.textSm,bg:T.muted,bd:T.border,l:"Normal"};
  return <span style={{fontFamily:T.sans,fontSize:10,fontWeight:700,color:cfg.c,background:cfg.bg,border:`1px solid ${cfg.bd}`,padding:"2px 7px",borderRadius:2}}>{cfg.l} ×{mult}</span>;
};

// Main planning view
const PlanningView = ({ products, suppliers, orders, plans, setPlans }) => {
  const months = getNextMonths(6);
  const [selProduct, setSelProduct] = useState(products[0]?.id || null);
  const [viewMode, setViewMode]     = useState("product"); // "product" | "summary"

  const getSup = id => suppliers.find(s=>s.id===id);

  // Get or init plan for a product
  const getPlan = (pid) => plans[pid] || {
    months: Object.fromEntries(months.map(m=>[m.key,{mult:1.0,manualQty:null}])),
    coverageMonths: 2,
  };

  const updateMonth = (pid, monthKey, field, val) => {
    setPlans(p => {
      const plan = getPlan(pid);
      return { ...p, [pid]: { ...plan, months: { ...plan.months, [monthKey]: { ...(plan.months[monthKey]||{}), [field]: val } } } };
    });
  };

  const updateCoverage = (pid, val) => {
    setPlans(p => { const plan = getPlan(pid); return { ...p, [pid]: { ...plan, coverageMonths: val } }; });
  };

  // Calculate projected demand for a product in a month
  const projectedDemand = (product, monthKey) => {
    const base = avgDaily(product.history) * 30;
    const plan = getPlan(product.id);
    const m = plan.months[monthKey] || {};
    if(m.manualQty !== null && m.manualQty !== undefined && m.manualQty !== "") return +m.manualQty;
    return Math.ceil(base * (m.mult || 1.0));
  };

  // How much to order considering lead time and coverage target
  const calcOrderQty = (product) => {
    const sup = getSup(product.supplierId);
    const lead = totalLead(sup);
    const plan = getPlan(product.id);
    const coverage = plan.coverageMonths || 2;

    // Total projected demand over lead + coverage period
    const totalDays = lead + coverage * 30;
    const dailyBase = avgDaily(product.history);

    // Sum projected monthly demand for coverage window
    let projected = 0;
    for(let i=0; i<coverage; i++) {
      const mkey = months[i]?.key;
      if(mkey) projected += projectedDemand(product, mkey);
      else projected += dailyBase * 30;
    }
    // Add safety stock
    const ss = safetyStock(product.history, lead);
    const needed = projected + ss;
    return Math.max(0, Math.ceil(needed - product.stock));
  };

  // Total projected cost for all products needing order
  const allProductsWithOrders = useMemo(() => {
    return products.map(p => {
      const sup = getSup(p.supplierId);
      const plan = getPlan(p.id);
      const qtyNeeded = calcOrderQty(p);
      const projections = months.map(m => projectedDemand(p, m.key));
      const totalProjected = projections.reduce((a,b)=>a+b,0);
      return { ...p, sup, plan, qtyNeeded, projections, totalProjected };
    });
  }, [products, plans, suppliers]);

  const needsOrder = allProductsWithOrders.filter(p=>p.qtyNeeded>0);
  const totalOrderCost = needsOrder.reduce((s,p)=>s+(p.qtyNeeded*(p.unitCost||0)),0);

  const selectedProduct = allProductsWithOrders.find(p=>p.id===selProduct);
  const selPlan = selectedProduct ? getPlan(selectedProduct.id) : null;

  return (
    <div style={{display:"grid",gap:28}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <Cap style={{color:T.green}}>Proyección</Cap>
          <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>
            Planificación · próximos 6 meses
          </h1>
          <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm,marginTop:6,lineHeight:1.6}}>
            Ajustá la demanda esperada por mes, definí temporadas altas y bajas, y el sistema calcula exactamente cuánto pedir de cada producto.
          </p>
        </div>
        <div style={{display:"flex",gap:8}}>
          {["product","summary"].map(m=>(
            <button key={m} onClick={()=>setViewMode(m)}
              style={{padding:"8px 16px",fontFamily:T.sans,fontSize:12,fontWeight:600,cursor:"pointer",borderRadius:4,
                background:viewMode===m?T.green:"transparent",color:viewMode===m?"#fff":T.textSm,
                border:`1px solid ${viewMode===m?T.green:T.border}`}}>
              {m==="product"?"Por producto":"Resumen general"}
            </button>
          ))}
        </div>
      </div>

      {/* ── PRODUCT VIEW ── */}
      {viewMode==="product" && (
        <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:16,alignItems:"start"}}>
          {/* Product list sidebar */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card,position:"sticky",top:20}}>
            <div style={{padding:"10px 14px",background:T.muted,borderBottom:`1px solid ${T.border}`}}><Cap>Productos</Cap></div>
            {allProductsWithOrders.map(p=>(
              <button key={p.id} onClick={()=>setSelProduct(p.id)}
                style={{width:"100%",textAlign:"left",padding:"10px 14px",background:selProduct===p.id?T.greenBg:"transparent",
                  border:"none",borderLeft:selProduct===p.id?`3px solid ${T.green}`:"3px solid transparent",
                  borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}>
                <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:selProduct===p.id?T.green:T.text}}>{p.name}</div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                  <span style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>[{p.sup?.flag}] {p.sup?.name}</span>
                  {p.qtyNeeded>0 && <span style={{fontFamily:T.sans,fontSize:10,fontWeight:700,color:T.danger}}>+{p.qtyNeeded} {p.unit}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Product detail planner */}
          {selectedProduct && selPlan && (
            <div style={{display:"grid",gap:16}}>
              {/* Product header */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"18px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                  <div>
                    <Cap style={{color:T.green}}>[{selectedProduct.sup?.flag}] {selectedProduct.sup?.name} · Lead {totalLead(selectedProduct.sup)}d</Cap>
                    <h2 style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:T.text,marginTop:4}}>{selectedProduct.name}</h2>
                    <div style={{display:"flex",gap:16,marginTop:6,flexWrap:"wrap"}}>
                      <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Stock actual: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong></span>
                      <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Consumo histórico prom.: <strong>{Math.round(avgDaily(selectedProduct.history)*30)} {selectedProduct.unit}/mes</strong></span>
                      <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>Costo unit.: <strong>{selectedProduct.currency||"USD"} {selectedProduct.unitCost}</strong></span>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <Cap>Cobertura objetivo</Cap>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginTop:6}}>
                      <input type="range" min="1" max="6" value={selPlan.coverageMonths||2}
                        onChange={e=>updateCoverage(selectedProduct.id,+e.target.value)}
                        style={{width:100}}/>
                      <span style={{fontFamily:T.serif,fontSize:24,fontWeight:500,color:T.green,minWidth:60}}>{selPlan.coverageMonths||2} mes{(selPlan.coverageMonths||2)>1?"es":""}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly projections table */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
                <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <Cap>Demanda proyectada mes a mes</Cap>
                  <Cap style={{color:T.textXs}}>Base histórica: {Math.round(avgDaily(selectedProduct.history)*30)} {selectedProduct.unit}/mes · Editá cualquier celda para sobreescribir</Cap>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${T.border}`}}>
                        <th style={{padding:"10px 14px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,minWidth:100}}>Mes</th>
                        <th style={{padding:"10px 14px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Temporada</th>
                        <th style={{padding:"10px 14px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Multiplicador</th>
                        <th style={{padding:"10px 14px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Qty manual</th>
                        <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Proyectado</th>
                        <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>Costo est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {months.map((m,i) => {
                        const mdata = selPlan.months[m.key] || {};
                        const isManual = mdata.manualQty !== null && mdata.manualQty !== undefined && mdata.manualQty !== "";
                        const projected = projectedDemand(selectedProduct, m.key);
                        const cost = projected * (selectedProduct.unitCost||0);
                        const mult = mdata.mult || 1.0;
                        return (
                          <tr key={m.key} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.cardWarm}}>
                            <td style={{padding:"11px 14px"}}>
                              <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{m.label}</div>
                              {i < (selPlan.coverageMonths||2) && (
                                <div style={{fontFamily:T.sans,fontSize:10,color:T.green,marginTop:2}}>● en cobertura objetivo</div>
                              )}
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"center"}}>
                              <select value={isManual?"manual":SEASON_PRESETS.find(p=>p.mult===mult)?.id||"normal"}
                                onChange={e=>{
                                  if(e.target.value==="manual") return;
                                  const preset = SEASON_PRESETS.find(p=>p.id===e.target.value);
                                  updateMonth(selectedProduct.id, m.key, "mult", preset?.mult||1.0);
                                  updateMonth(selectedProduct.id, m.key, "manualQty", null);
                                }}
                                style={{fontFamily:T.sans,fontSize:11,border:`1px solid ${T.border}`,borderRadius:3,padding:"4px 6px",background:T.card,color:T.text,cursor:"pointer"}}>
                                {SEASON_PRESETS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
                                {isManual && <option value="manual">Manual</option>}
                              </select>
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"center"}}>
                              {!isManual ? <SeasonBadge mult={mult}/> : <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs,fontStyle:"italic"}}>manual</span>}
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"center"}}>
                              <input type="number" min="0"
                                value={isManual ? mdata.manualQty : ""}
                                placeholder={String(Math.ceil(avgDaily(selectedProduct.history)*30*(mult||1)))}
                                onChange={e=>updateMonth(selectedProduct.id, m.key, "manualQty", e.target.value===""?null:+e.target.value)}
                                style={{width:80,fontFamily:T.sans,fontSize:12,border:`1px solid ${isManual?T.green:T.border}`,borderRadius:3,padding:"5px 8px",textAlign:"center",background:isManual?T.greenBg:T.card,color:isManual?T.green:T.text}}/>
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"right"}}>
                              <span style={{fontFamily:T.serif,fontSize:16,fontWeight:500,color:T.text}}>{projected}</span>
                              <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginLeft:4}}>{selectedProduct.unit}</span>
                            </td>
                            <td style={{padding:"11px 14px",textAlign:"right"}}>
                              <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>USD {cost.toFixed(0)}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{borderTop:`2px solid ${T.border}`,background:T.muted}}>
                        <td colSpan={4} style={{padding:"12px 14px",fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.text}}>Total proyectado 6 meses</td>
                        <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.serif,fontSize:18,fontWeight:600,color:T.text}}>
                          {selectedProduct.projections.reduce((a,b)=>a+b,0)} {selectedProduct.unit}
                        </td>
                        <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>
                          USD {(selectedProduct.projections.reduce((a,b)=>a+b,0)*(selectedProduct.unitCost||0)).toFixed(0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Visual bar chart */}
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"16px 20px"}}>
                <Cap>Proyección visual</Cap>
                <div style={{display:"flex",gap:6,alignItems:"flex-end",height:90,marginTop:14,paddingBottom:4}}>
                  {months.map((m,i)=>{
                    const projected = projectedDemand(selectedProduct, m.key);
                    const maxP = Math.max(...months.map(mx=>projectedDemand(selectedProduct,mx.key)),1);
                    const pct = projected/maxP;
                    const mdata = selPlan.months[m.key]||{};
                    const isManual = mdata.manualQty !== null && mdata.manualQty !== undefined && mdata.manualQty !== "";
                    const inCoverage = i < (selPlan.coverageMonths||2);
                    return (
                      <div key={m.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{fontFamily:T.sans,fontSize:10,color:T.textSm}}>{projected}</div>
                        <div style={{width:"100%",height:Math.max(8,pct*70),
                          background:isManual?T.green:inCoverage?T.greenLt:T.muted,
                          borderRadius:"3px 3px 0 0",border:`1px solid ${inCoverage?T.greenBd:T.border}`,
                          transition:"height .3s"}}/>
                        <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs,textAlign:"center",lineHeight:1.2}}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:14,marginTop:8}}>
                  {[{c:T.green,l:"Ingreso manual"},{c:T.greenLt,l:"En cobertura (automático)"},{c:T.muted,l:"Fuera de cobertura"}].map(({c,l})=>(
                    <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontFamily:T.sans,fontSize:10,color:T.textSm}}>
                      <span style={{width:10,height:10,background:c,borderRadius:2,display:"inline-block"}}/>{l}
                    </span>
                  ))}
                </div>
              </div>

              {/* Order recommendation */}
              <div style={{background:selectedProduct.qtyNeeded>0?T.dangerBg:T.okBg,border:`1px solid ${selectedProduct.qtyNeeded>0?T.dangerBd:T.okBd}`,borderRadius:8,padding:"16px 20px"}}>
                <Cap style={{color:selectedProduct.qtyNeeded>0?T.danger:T.ok}}>
                  {selectedProduct.qtyNeeded>0?"Recomendación de pedido":"Stock suficiente"}
                </Cap>
                {selectedProduct.qtyNeeded>0 ? (
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:16,marginTop:10,alignItems:"center"}}>
                    <div>
                      <div style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.danger}}>
                        Pedir {selectedProduct.qtyNeeded} {selectedProduct.unit}
                      </div>
                      <p style={{fontFamily:T.sans,fontSize:12,color:T.textMd,marginTop:6,lineHeight:1.6}}>
                        Para cubrir la demanda proyectada de <strong>{selPlan.coverageMonths||2} meses</strong> + stock de seguridad ({safetyStock(selectedProduct.history,totalLead(selectedProduct.sup))} {selectedProduct.unit}),
                        considerando el lead time de <strong>{totalLead(selectedProduct.sup)} días</strong> de {selectedProduct.sup?.name}.
                        Costo estimado: <strong>USD {(selectedProduct.qtyNeeded*(selectedProduct.unitCost||0)).toFixed(2)}</strong>
                      </p>
                    </div>
                    <Btn onClick={()=>{}} variant="warning" small>Generar pedido</Btn>
                  </div>
                ) : (
                  <p style={{fontFamily:T.sans,fontSize:13,color:T.ok,marginTop:6}}>
                    El stock actual ({selectedProduct.stock} {selectedProduct.unit}) es suficiente para cubrir los próximos {selPlan.coverageMonths||2} meses de demanda proyectada.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUMMARY VIEW ── */}
      {viewMode==="summary" && (
        <div style={{display:"grid",gap:20}}>
          {/* Summary stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
            {[
              {l:"Productos planificados", v:Object.keys(plans).length},
              {l:"Necesitan pedido",        v:needsOrder.length, c:needsOrder.length>0?T.danger:T.text},
              {l:"Total proyectado",        v:`USD ${allProductsWithOrders.reduce((s,p)=>s+(p.totalProjected*(p.unitCost||0)),0).toFixed(0)}`},
              {l:"Costo pedidos necesarios",v:`USD ${totalOrderCost.toFixed(0)}`, c:totalOrderCost>0?T.warning:T.text},
            ].map((s,i)=>(
              <div key={i} style={{background:T.card,padding:"18px 20px"}}>
                <Cap>{s.l}</Cap>
                <div style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:s.c||T.text,marginTop:6}}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Monthly demand heatmap — all products */}
          <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto"}}>
            <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}>
              <Cap>Demanda proyectada total por mes (todos los productos)</Cap>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${T.border}`}}>
                  <th style={{padding:"10px 14px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm,minWidth:140}}>Producto</th>
                  {months.map(m=><th key={m.key} style={{padding:"10px 10px",textAlign:"center",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm,minWidth:70}}>{m.label}</th>)}
                  <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm}}>Total</th>
                  <th style={{padding:"10px 14px",textAlign:"right",fontFamily:T.sans,fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:T.textSm}}>Pedir</th>
                </tr>
              </thead>
              <tbody>
                {allProductsWithOrders.map((p,ri)=>{
                  const maxForRow = Math.max(...p.projections, 1);
                  return (
                    <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:ri%2===0?T.card:T.cardWarm}}>
                      <td style={{padding:"11px 14px"}}>
                        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{p.name}</div>
                        <div style={{fontFamily:T.sans,fontSize:10,color:T.textXs}}>[{p.sup?.flag}] {p.sup?.name}</div>
                      </td>
                      {months.map((m,ci)=>{
                        const val = p.projections[ci];
                        const intensity = val/maxForRow;
                        return (
                          <td key={m.key} style={{padding:"8px 10px",textAlign:"center"}}>
                            <div style={{background:`rgba(45,90,27,${intensity*0.25+0.04})`,borderRadius:3,padding:"4px 6px",cursor:"pointer"}}
                              onClick={()=>{setSelProduct(p.id);setViewMode("product");}}>
                              <span style={{fontFamily:T.sans,fontSize:12,fontWeight:intensity>0.7?600:400,color:intensity>0.6?T.green:T.textMd}}>{val}</span>
                            </div>
                          </td>
                        );
                      })}
                      <td style={{padding:"11px 14px",textAlign:"right",fontFamily:T.serif,fontSize:15,fontWeight:500,color:T.text}}>{p.totalProjected} {p.unit}</td>
                      <td style={{padding:"11px 14px",textAlign:"right"}}>
                        {p.qtyNeeded>0
                          ? <span style={{fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.danger}}>+{p.qtyNeeded} {p.unit}</span>
                          : <span style={{fontFamily:T.sans,fontSize:12,color:T.ok}}>✓</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{borderTop:`2px solid ${T.border}`,background:T.muted}}>
                  <td style={{padding:"12px 14px",fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.text}}>Costo total estimado</td>
                  {months.map((m,i)=>(
                    <td key={m.key} style={{padding:"12px 10px",textAlign:"center",fontFamily:T.sans,fontSize:11,fontWeight:600,color:T.textMd}}>
                      USD {allProductsWithOrders.reduce((s,p)=>s+(p.projections[i]*(p.unitCost||0)),0).toFixed(0)}
                    </td>
                  ))}
                  <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.sans,fontSize:13,fontWeight:700,color:T.text}}>
                    USD {allProductsWithOrders.reduce((s,p)=>s+(p.totalProjected*(p.unitCost||0)),0).toFixed(0)}
                  </td>
                  <td style={{padding:"12px 14px",textAlign:"right",fontFamily:T.sans,fontSize:12,fontWeight:700,color:T.danger}}>
                    USD {totalOrderCost.toFixed(0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Per-supplier order consolidation */}
          {needsOrder.length>0 && (
            <div>
              <div style={{marginBottom:10}}>
                <Cap>Pedidos consolidados por proveedor</Cap>
                <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:4}}>Agrupá tus pedidos para aprovechar mínimos y descuentos.</p>
              </div>
              <div style={{display:"grid",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                {suppliers.map(sup=>{
                  const supNeeds = needsOrder.filter(p=>p.supplierId===sup.id);
                  if(!supNeeds.length) return null;
                  const totalCost = supNeeds.reduce((s,p)=>s+(p.qtyNeeded*(p.unitCost||0)),0);
                  const minOrder = +(sup.minOrder||0);
                  const meetsMin = totalCost >= minOrder || minOrder===0;
                  return (
                    <div key={sup.id} style={{background:T.card,padding:"16px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{background:sup.color+"22",color:sup.color,fontFamily:T.sans,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:3}}>{sup.flag}</span>
                          <div>
                            <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text}}>{sup.name}</div>
                            {sup.company&&<div style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>{sup.company}</div>}
                          </div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:meetsMin?T.ok:T.warning}}>
                            {sup.currency||"USD"} {totalCost.toFixed(0)}
                          </div>
                          {!meetsMin && <div style={{fontFamily:T.sans,fontSize:11,color:T.warning,marginTop:2}}>⚠ Mínimo: {sup.currency||"USD"} {minOrder} — faltan {sup.currency||"USD"} {(minOrder-totalCost).toFixed(0)}</div>}
                          {meetsMin && minOrder>0 && <div style={{fontFamily:T.sans,fontSize:11,color:T.ok,marginTop:2}}>✓ Supera pedido mínimo</div>}
                          {sup.discount>0 && totalCost >= minOrder && <div style={{fontFamily:T.sans,fontSize:11,color:T.green,marginTop:2}}>🏷️ Descuento {sup.discount}% aplicable</div>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:1,background:T.border,borderRadius:4,overflow:"hidden"}}>
                        {supNeeds.map(p=>(
                          <div key={p.id} style={{background:T.cardWarm,padding:"8px 12px",flex:1}}>
                            <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{p.name}</div>
                            <div style={{fontFamily:T.serif,fontSize:16,fontWeight:500,color:T.danger,marginTop:2}}>{p.qtyNeeded} {p.unit}</div>
                            <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>USD {(p.qtyNeeded*(p.unitCost||0)).toFixed(0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// MOVEMENTS VIEW — Historial completo de movimientos
// ─────────────────────────────────────────────────────────────────────────────
const MOV_CFG = {
  order_placed: { icon:"📋", label:"Pedido generado",   color:"#1d4ed8", bg:"#eff6ff", bd:"#bfdbfe" },
  delivery:     { icon:"📦", label:"Mercadería recibida",color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  scanner_in:   { icon:"⌨️", label:"Ingreso scanner",    color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  excel_in:     { icon:"📊", label:"Ajuste Excel +",     color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  excel_out:    { icon:"📊", label:"Ajuste Excel −",     color:"#b91c1c", bg:"#fef2f2", bd:"#fecaca" },
  manual_in:    { icon:"➕", label:"Entrada manual",     color:"#166534", bg:"#f0fdf4", bd:"#bbf7d0" },
  manual_out:   { icon:"➖", label:"Salida manual",      color:"#b91c1c", bg:"#fef2f2", bd:"#fecaca" },
  adjustment:   { icon:"⚖️", label:"Ajuste de inventario",color:"#92400e",bg:"#fffbeb",bd:"#fde68a" },
};

const MovTypeTag = ({type}) => {
  const c = MOV_CFG[type] || {icon:"•",label:type,color:T.textSm,bg:T.muted,bd:T.border};
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg,border:`1px solid ${c.bd}`,color:c.color,
      fontFamily:T.sans,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",padding:"3px 8px",borderRadius:3}}>
      {c.icon} {c.label}
    </span>
  );
};

const MovementsView = ({ movements, products, suppliers, onAddManual }) => {
  const [filterProd, setFilterProd] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]   = useState("");
  const [search, setSearch] = useState("");
  const [showManualModal, setShowManualModal] = useState(false);

  const filtered = useMemo(() => {
    return movements.filter(m => {
      if(filterProd !== "all" && m.productId !== filterProd) return false;
      if(filterType !== "all" && m.type !== filterType) return false;
      if(filterDateFrom && m.ts < filterDateFrom) return false;
      if(filterDateTo   && m.ts > filterDateTo+"T23:59:59") return false;
      if(search && !m.productName?.toLowerCase().includes(search.toLowerCase()) && !m.note?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [movements, filterProd, filterType, filterDateFrom, filterDateTo, search]);

  // Stats
  const totalIn  = filtered.filter(m=>["delivery","scanner_in","excel_in","manual_in"].includes(m.type)).reduce((s,m)=>s+m.qty,0);
  const totalOut = filtered.filter(m=>["excel_out","manual_out"].includes(m.type)).reduce((s,m)=>s+m.qty,0);
  const orderCount = filtered.filter(m=>m.type==="order_placed").length;

  // Product options for filter
  const prodOptions = [...new Set(movements.map(m=>m.productId))].map(id=>{
    const p = products.find(x=>x.id===id||x.id===+id);
    return { id, name: p?.name || id };
  });

  return (
    <div style={{display:"grid",gap:24}}>
      {showManualModal && <ManualMovModal products={products} onSave={(m)=>{onAddManual(m);setShowManualModal(false);}} onClose={()=>setShowManualModal(false)}/>}

      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
        <div>
          <Cap style={{color:T.green}}>Auditoría</Cap>
          <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Historial de movimientos</h1>
          <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm,marginTop:5,lineHeight:1.5}}>
            Registro completo de todas las entradas, salidas y ajustes de stock.
          </p>
        </div>
        <Btn onClick={()=>setShowManualModal(true)}>+ Movimiento manual</Btn>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
        {[
          {l:"Total movimientos",v:filtered.length},
          {l:"Entradas",         v:totalIn,  c:T.ok},
          {l:"Salidas",          v:totalOut, c:T.danger},
          {l:"Pedidos generados",v:orderCount,c:T.watch},
        ].map((s,i)=>(
          <div key={i} style={{background:T.card,padding:"18px 20px"}}>
            <Cap>{s.l}</Cap>
            <div style={{fontFamily:T.serif,fontSize:40,fontWeight:400,color:s.c||T.text,lineHeight:1,marginTop:8}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"14px 18px"}}>
        <Cap>Filtros</Cap>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr",gap:12,marginTop:10}}>
          <Field label="Buscar">
            <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Producto o nota..."/>
          </Field>
          <Field label="Producto">
            <Sel value={filterProd} onChange={e=>setFilterProd(e.target.value)}>
              <option value="all">Todos los productos</option>
              {prodOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </Sel>
          </Field>
          <Field label="Tipo de movimiento">
            <Sel value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="all">Todos los tipos</option>
              {Object.entries(MOV_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </Sel>
          </Field>
          <Field label="Desde">
            <Inp type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)}/>
          </Field>
          <Field label="Hasta">
            <Inp type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)}/>
          </Field>
        </div>
        {(search||filterProd!=="all"||filterType!=="all"||filterDateFrom||filterDateTo) && (
          <button onClick={()=>{setSearch("");setFilterProd("all");setFilterType("all");setFilterDateFrom("");setFilterDateTo("");}}
            style={{fontFamily:T.sans,fontSize:11,color:T.green,background:"none",border:"none",cursor:"pointer",marginTop:8,fontWeight:600}}>
            × Limpiar filtros
          </button>
        )}
      </div>

      {/* Movements table */}
      {filtered.length === 0 ? (
        <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:8,padding:"48px 32px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:12}}>📋</div>
          <p style={{fontFamily:T.sans,fontSize:14,color:T.textSm,fontWeight:500}}>
            {movements.length===0 ? "Sin movimientos registrados aún." : "Sin movimientos que coincidan con los filtros."}
          </p>
          {movements.length===0 && (
            <p style={{fontFamily:T.sans,fontSize:12,color:T.textXs,marginTop:6,lineHeight:1.6}}>
              Los movimientos se registran automáticamente al generar pedidos, marcar entregas, usar el scanner o importar Excel.
            </p>
          )}
        </div>
      ) : (
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                {["Fecha y hora","Tipo","Producto","Proveedor","Cantidad","Nota / Referencia"].map(h=>(
                  <th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m,i)=>{
                const cfg = MOV_CFG[m.type]||{color:T.textSm};
                const isIn  = ["delivery","scanner_in","excel_in","manual_in"].includes(m.type);
                const isOut = ["excel_out","manual_out"].includes(m.type);
                const d = new Date(m.ts);
                return (
                  <tr key={m.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2===0?T.card:T.cardWarm}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.hover}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.card:T.cardWarm}>
                    <td style={{padding:"10px 13px",whiteSpace:"nowrap"}}>
                      <div style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>
                        {d.toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"})}
                      </div>
                      <div style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>
                        {d.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </td>
                    <td style={{padding:"10px 13px"}}><MovTypeTag type={m.type}/></td>
                    <td style={{padding:"10px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>
                      {m.productName}
                    </td>
                    <td style={{padding:"10px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>
                      {m.supplierName||"—"}
                    </td>
                    <td style={{padding:"10px 13px",whiteSpace:"nowrap"}}>
                      <span style={{fontFamily:T.serif,fontSize:16,fontWeight:600,
                        color:isIn?T.ok:isOut?T.danger:T.watch}}>
                        {isIn?"+":isOut?"−":""}{m.qty} {m.unit}
                      </span>
                    </td>
                    <td style={{padding:"10px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm,maxWidth:280}}>
                      {m.note||"—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Export hint */}
      {filtered.length>0 && (
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button onClick={()=>{
            const rows=[["Fecha","Hora","Tipo","Producto","Proveedor","Cantidad","Unidad","Nota"],...filtered.map(m=>{const d=new Date(m.ts);return[d.toLocaleDateString("es-UY"),d.toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"}),(MOV_CFG[m.type]||{label:m.type}).label,m.productName,m.supplierName||"",m.qty,m.unit,m.note||""];})];
            const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
            const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,﻿"+encodeURIComponent(csv);a.download=`aryes-movimientos-${new Date().toISOString().slice(0,10)}.csv`;a.click();
          }} style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.green,background:T.greenBg,border:`1px solid ${T.greenBd}`,padding:"8px 16px",borderRadius:4,cursor:"pointer"}}>
            ↓ Exportar CSV ({filtered.length} registros)
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL MOVEMENT MODAL
// ─────────────────────────────────────────────────────────────────────────────
const ManualMovModal = ({ products, onSave, onClose }) => {
  const [f, setF] = useState({ productId:"", type:"manual_in", qty:1, note:"" });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const selProd = products.find(p=>p.id===+f.productId||p.id===f.productId);
  const valid = f.productId && f.qty > 0;
  const handle = () => {
    if(!valid) return;
    onSave({
      type: f.type,
      productId: selProd.id,
      productName: selProd.name,
      supplierId: selProd.supplierId,
      supplierName: "",
      qty: +f.qty,
      unit: selProd.unit,
      note: f.note || (f.type==="manual_in"?"Entrada manual":"Salida manual"),
    });
  };
  return (
    <Modal title="Registrar movimiento manual" sub="Historial" onClose={onClose}>
      <div style={{display:"grid",gap:16}}>
        <div style={{background:T.watchBg,border:`1px solid ${T.watchBd}`,borderRadius:4,padding:"10px 14px"}}>
          <p style={{fontFamily:T.sans,fontSize:12,color:T.watch,lineHeight:1.6}}>
            Usá esto para correcciones de inventario, mermas, ajustes por conteo físico, o cualquier movimiento que no fue capturado automáticamente.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Field label="Tipo de movimiento">
            <Sel value={f.type} onChange={e=>set("type",e.target.value)}>
              <option value="manual_in">➕ Entrada manual</option>
              <option value="manual_out">➖ Salida manual</option>
              <option value="adjustment">⚖️ Ajuste de inventario</option>
            </Sel>
          </Field>
          <Field label="Producto">
            <Sel value={f.productId} onChange={e=>set("productId",e.target.value)}>
              <option value="">— Seleccioná —</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit})</option>)}
            </Sel>
          </Field>
        </div>
        <Field label={`Cantidad${selProd?" ("+selProd.unit+")":""}`}>
          <Inp type="number" min="0" value={f.qty} onChange={e=>set("qty",+e.target.value)}/>
        </Field>
        {selProd && f.type !== "adjustment" && (
          <div style={{background:T.muted,borderRadius:4,padding:"10px 14px"}}>
            <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>
              Stock actual: <strong>{selProd.stock} {selProd.unit}</strong> →
              Stock después: <strong style={{color:f.type==="manual_in"?T.ok:T.danger}}>
                {f.type==="manual_in"?(selProd.stock+(+f.qty||0)):(selProd.stock-(+f.qty||0))} {selProd.unit}
              </strong>
            </p>
          </div>
        )}
        <Field label="Nota / Motivo" hint="Ej: Merma por vencimiento, Ajuste conteo físico, Cortesía cliente, etc.">
          <Inp value={f.note} onChange={e=>set("note",e.target.value)} placeholder="Motivo del movimiento..."/>
        </Field>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={handle} full disabled={!valid}>Registrar movimiento</Btn>
          <Btn onClick={onClose} variant="ghost">Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// EMAIL SETTINGS VIEW
// ─────────────────────────────────────────────────────────────────────────────
const EmailSettings = ({ cfg, setCfg, enriched, onTestSend, onManualSend }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const set = (k,v) => setCfg(c=>({...c,[k]:v}));
  const configured = cfg.serviceId && cfg.templateId && cfg.publicKey && cfg.toEmail;

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const resp = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          service_id: cfg.serviceId, template_id: cfg.templateId, user_id: cfg.publicKey,
          template_params: { to_email: cfg.toEmail, subject:"✓ Aryes — Email de prueba funcionando", html_content:"<p style='font-family:sans-serif;padding:20px;'>✅ Las notificaciones de Aryes están configuradas correctamente. Recibirás alertas automáticas cuando el stock cruce el punto de pedido.</p>", alert_count:0 }
        })
      });
      setTestResult(resp.status===200?"ok":"error");
    } catch { setTestResult("error"); }
    setTesting(false);
  };

  const alertProds = enriched.filter(p=>p.alert.level==="order_now"||p.alert.level==="order_soon");

  return (
    <div style={{display:"grid",gap:20,maxWidth:680}}>
      {/* Status banner */}
      <div style={{background:cfg.enabled&&configured?T.okBg:T.warnBg, border:`1px solid ${cfg.enabled&&configured?T.okBd:T.warnBd}`, borderRadius:8, padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:cfg.enabled&&configured?T.ok:T.warning}}>
            {cfg.enabled&&configured ? "✓ Notificaciones activas" : configured ? "Notificaciones desactivadas" : "⚠ Pendiente de configuración"}
          </div>
          <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:3}}>
            {cfg.enabled&&configured ? `Enviando alertas a ${cfg.toEmail}` : !configured ? "Completá los datos de EmailJS para activar" : "Activá el switch para empezar a recibir alertas"}
          </p>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
          <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{cfg.enabled?"ON":"OFF"}</span>
          <div onClick={()=>set("enabled",!cfg.enabled)}
            style={{width:44,height:24,borderRadius:12,background:cfg.enabled?T.green:T.border,position:"relative",cursor:"pointer",transition:"background .2s"}}>
            <div style={{position:"absolute",top:3,left:cfg.enabled?22:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
          </div>
        </label>
      </div>

      {/* How to setup guide */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}>
          <Cap>Cómo configurar EmailJS (gratis — 200 emails/mes)</Cap>
        </div>
        <div style={{padding:"16px 18px",display:"grid",gap:10}}>
          {[
            {n:1, t:"Creá cuenta gratis", d:<>Entrá a <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{color:T.green,fontWeight:600}}>emailjs.com</a> → Sign Up gratis</>, },
            {n:2, t:"Conectá tu email",   d:"En el panel → Email Services → Add New Service → elegí Gmail, Outlook o el que uses → conectá tu cuenta"},
            {n:3, t:"Creá un template",   d:'En Email Templates → Create New → en el cuerpo del email escribí exactamente: {{{html_content}}} — así Aryes puede enviar el HTML del reporte'},
            {n:4, t:"Copiá las claves",   d:"Service ID (en Email Services), Template ID (en Email Templates), Public Key (en Account → API Keys)"},
            {n:5, t:"Pegá las claves abajo y activá", d:"Completá los 4 campos, activá el switch de arriba, y hacé click en 'Enviar email de prueba'"},
          ].map(s=>(
            <div key={s.n} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:24,height:24,borderRadius:"50%",background:T.green,color:"#fff",fontFamily:T.sans,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.n}</div>
              <div>
                <div style={{fontFamily:T.sans,fontSize:13,fontWeight:600,color:T.text}}>{s.t}</div>
                <div style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginTop:2,lineHeight:1.5}}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config fields */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"12px 18px",background:T.muted,borderBottom:`1px solid ${T.border}`}}><Cap>Configuración EmailJS</Cap></div>
        <div style={{padding:"16px 18px",display:"grid",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="Service ID" hint="Ej: service_abc123">
              <Inp value={cfg.serviceId} onChange={e=>set("serviceId",e.target.value)} placeholder="service_xxxxxxx"/>
            </Field>
            <Field label="Template ID" hint="Ej: template_abc123">
              <Inp value={cfg.templateId} onChange={e=>set("templateId",e.target.value)} placeholder="template_xxxxxxx"/>
            </Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <Field label="Public Key" hint="En Account → API Keys">
              <Inp value={cfg.publicKey} onChange={e=>set("publicKey",e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxx"/>
            </Field>
            <Field label="Email de destino" hint="Donde querés recibir las alertas">
              <Inp type="email" value={cfg.toEmail} onChange={e=>set("toEmail",e.target.value)} placeholder="tu@email.com"/>
            </Field>
          </div>
        </div>
      </div>

      {/* Test + manual send */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          <Btn onClick={handleTest} full disabled={!configured||testing} variant="ghost">
            {testing ? "Enviando..." : "✉ Enviar email de prueba"}
          </Btn>
          {testResult==="ok" && <p style={{fontFamily:T.sans,fontSize:12,color:T.ok,marginTop:6,textAlign:"center"}}>✓ Email enviado correctamente</p>}
          {testResult==="error" && <p style={{fontFamily:T.sans,fontSize:12,color:T.danger,marginTop:6,textAlign:"center"}}>✗ Error — verificá las claves</p>}
        </div>
        <div>
          <Btn onClick={()=>onManualSend(alertProds)} full disabled={!configured||!alertProds.length}>
            📋 Enviar resumen ahora ({alertProds.length} alertas)
          </Btn>
          {!alertProds.length && <p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:6,textAlign:"center"}}>Sin alertas activas ahora mismo</p>}
        </div>
      </div>

      {/* Alert behavior info */}
      <div style={{background:T.cardWarm,border:`1px solid ${T.border}`,borderRadius:6,padding:"14px 18px"}}>
        <Cap>Comportamiento de las alertas automáticas</Cap>
        <div style={{display:"grid",gap:8,marginTop:12}}>
          {[
            {icon:"🔴", t:"Pedir YA",     d:"Email inmediato cuando el stock cae por debajo del punto de pedido (ROP)"},
            {icon:"🟡", t:"Pedir pronto", d:"Email inmediato cuando quedan ≤5 días para cruzar el ROP"},
            {icon:"🔄", t:"Sin repetición", d:"No manda el mismo email dos veces para el mismo producto — espera hasta que el stock cambie"},
            {icon:"📋", t:"Resumen manual", d:"Podés pedir el resumen de todas las alertas activas en cualquier momento con el botón de arriba"},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
              <div>
                <span style={{fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.text}}>{r.t} — </span>
                <span style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{r.d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER TAB — Catálogo Lovable (249 productos)
// ─────────────────────────────────────────────────────────────────────────────
const LOVABLE_CATALOG = [{"id":"p-0001","name":"Chocolate Cobertura Confeiteiro con Leche, Semiamargo y Blanco 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":336.07,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0002","name":"Chocolate Cobertura Supreme Amargo 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0003","name":"Chocolate Gotas Supreme con Leche, Semiamargo y Blanco 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0004","name":"Chocolate Ganache c/Leche, Semiamargo y Blanco 4 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":311.48,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0005","name":"Chocolate Chips Negro o Blanco 1 kg.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0006","name":"Cacao polvo Namur 500 grs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":659.84,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0007","name":"Cacao polvo Namur 10 kgs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":459.02,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0008","name":"Chocolate Granizado (mini gotas) semiamargo 8 kgs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":282.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0009","name":"Microgalletitas b/chocolate 7 kgs.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":680.33,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0010","name":"Relleno y Cobertura Sabor Chantilly, Vainilla o Frutilla por 4,7 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":217.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0011","name":"Relleno y Cobertura Sabor Chantilly Vainilla o Frutilla por 1 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":250.0,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0012","name":"Relleno y Cobertura Sabor Chantilly Vainilla o Frutilla por 500 g.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":303.28,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0013","name":"Relleno y Cobertura Sabor Chocolate por 4,5 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":270.49,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0014","name":"Relleno y Cobertura Sabor Chocolate  por 1 kg.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":327.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0015","name":"Relleno y Cobertura Sabor Chocolate  por 500 g.","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":360.66,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0016","name":"Merengue en polvo por 250 grs. (1 kg. polvo + 400 cc.agua+12 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":385.25,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0017","name":"Merengue en polvo por 4 kgs. ( 1 kg. polvo + 400 cc.agua+12 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":270.49,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0018","name":"Crema pastelera por 250 grs. (750 cc. agua + 250 gr.polvo + 5 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":418.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0019","name":"Crema pastelera por 4 Kg. (750 cc. agua + 250 gr.polvo + 5 min batido)","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":319.67,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0020","name":"Mousse Chantilly / Frutilla / Chocolate por 250 grs.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":627.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0021","name":"Mousse Chantilly / Frutilla / Chocolate por 1 kg.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":602.46,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0022","name":"Gel de Brillo Neutro / Frutilla por 310 grs.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":237.7,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0023","name":"Destello Neutro / Frutilla por 4,4 kg.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":159.84,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0024","name":"Gel de Brillo Neutro en Caliente por 10 kg.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":131.15,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0025","name":"Crema Paris (cubretortas chocolate intenso) por 280 grs.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":401.64,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0026","name":"Crema Paris (baño tipo ganache) por 4 kg.","brand":"Ledevit","category":"Brillos","supplierId":"arg","unitCost":327.89,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0027","name":"Mix Cupcake vainilla 500 grs.","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":233.61,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0028","name":"Mix Brownie 470 grs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":258.2,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0029","name":"Mix Brownie 4 kgs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":217.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0030","name":"Mix Budín vainilla 500 grs.","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":213.11,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0031","name":"Mix Macarrones 250 grs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":532.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0032","name":"Mix Macarron 3,5 kgs","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":422.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0033","name":"Azúcar impalpable 1 kg.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":176.23,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0034","name":"Glacé Real 1 kg.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":213.11,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0035","name":"Fondant 1 kg.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":196.72,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0036","name":"Pastamix 800 grs.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":307.38,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0037","name":"Pastamix 3 kgs.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":1020.49,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0038","name":"Pasta Americana Colorful 800 g.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":315.57,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0039","name":"Rendamix 100 g.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":155.74,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0040","name":"Pasta Americana Mix 4,5 kgs.","brand":"Duas Rodas","category":"Decoración","supplierId":"arg","unitCost":1536.89,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0041","name":"Azúcar Colores 80 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":45.08,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0042","name":"Azúcar Colores 500 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":131.15,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0043","name":"Granas Colores 120 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":45.08,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0044","name":"Granas Colores 500 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":131.15,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0045","name":"Grageas Colores 100 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":53.27,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0046","name":"Grageas Colores 500 grs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":159.84,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0047","name":"Granas Colores 5 kgrs.","brand":"Duas Rodas","category":"Confites","supplierId":"arg","unitCost":163.93,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0048","name":"AROMATIZANTES 30 ml: limón, nuez, chocolate, naranja,","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":61.48,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0049","name":"AROMATIZANTES  1 lt. Vainilla, Vainilla blanca","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":217.21,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0050","name":"AROMATIZANTES  1 lt. Chocolate, Coco, Manteca, Frutilla, Queso, Panettone","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":245.9,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0051","name":"AROMATIZANTES  1 lt. Naranja, Limón, Menta","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":360.65,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0052","name":"Color gel 15 g.","brand":"Duas Rodas","category":"Colorantes","supplierId":"arg","unitCost":65.57,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0053","name":"Color softgel 25 g.","brand":"Duas Rodas","category":"Colorantes","supplierId":"arg","unitCost":110.66,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0054","name":"Color softgel Big 150 g.","brand":"Duas Rodas","category":"Colorantes","supplierId":"arg","unitCost":352.46,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0055","name":"Color polvo esfumado 3 g.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":139.34,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0056","name":"Color pen 60 g.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":135.25,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0057","name":"Color líquido 10 ml.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":45.08,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0058","name":"Colorante liquido 1 lt.","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":155.74,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0059","name":"Acido Cítrico 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0060","name":"Agar Agar 30 g","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":299.18,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0061","name":"CMC (Carbometil Celulosa) 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":110.65,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0062","name":"Cremor Tártaro por 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0063","name":"Gel Confitero 50 grs","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0064","name":"Glucosa jarabe 150 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":98.36,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0065","name":"Glucosa jarabe 500 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":163.93,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0066","name":"Glucosa jarabe 1 kg.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":245.9,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0067","name":"Glucosa polvo (dextrosa) 50 g.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":81.97,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0068","name":"Emustab (Emulsificante) 200 grs.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":121.32,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0069","name":"Emustab por 1 kg.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":418.03,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0070","name":"Gelatina neutra por 1 kg.","brand":"Duas Rodas","category":"Aditivos","supplierId":"arg","unitCost":1065.57,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0071","name":"CHOCOLATE AMARGO DARK 70% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1385.25,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0072","name":"CHOCOLATE AMARGO DARK 70% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1295.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0073","name":"CHOCOLATE AMARGO BLACK 65% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1229.51,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0074","name":"CHOCOLATE AMARGO BLACK 65% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1200.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0075","name":"CHOCOLATE FLUIDO 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1217.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0076","name":"CHOCOLATE FLUIDO 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1192.62,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0077","name":"CHOCOLATE S/AMARGO 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1118.85,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0078","name":"CHOCOLATE S/AMARGO 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1045.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0079","name":"CHOCOLATE C/LECHE CARAMELIZADO 40% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0080","name":"CHOCOLATE C/LECHE BLEND 35% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0081","name":"CHOCOLATE C/LECHE BLEND 35% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1045.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0082","name":"CHOCOLATE BLANCO C/MAIZ 33% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1270.49,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0083","name":"CHOCOLATE BLANCO 31% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0084","name":"CHOCOLATE BLANCO 31% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1045.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0085","name":"CACAO POLVO 22-24% 2,25 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1311.48,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0086","name":"NIBS CACAO 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":2049.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0087","name":"LICOR CACAO 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":2000.0,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0088","name":"CHOCOLATE S/AMARGO TRONADOR 55%","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":918.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0089","name":"CHOCOLATE C/LECHE TRONADOR","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":918.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0090","name":"CHOCOLATE BLANCO","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":918.03,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0091","name":"CHOCOLATE AMARGO 71%","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1135.25,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0092","name":"Preparado selecta top 1 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":286.88,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0093","name":"Crema Chocolat 1 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":442.62,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0094","name":"Variegato Frutales 2 Kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":565.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0095","name":"Variegato Frutales 12 Kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":528.69,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0096","name":"Variegato Frutales Zero 1 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":655.74,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0097","name":"Veteado Chocolat 2 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":545.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0098","name":"Veteado Chocolat 12 kg.","brand":"Duas Rodas","category":"Variagatos","supplierId":"arg","unitCost":631.15,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0099","name":"Super liga Neutra por 20 kgs. estabilizante en frío ó caliente","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":245.9,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0100","name":"Emustab por 10 kg.","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":282.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0101","name":"Emustab por 3 kg.","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":327.86,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0102","name":"Estabilizante Aqua 5 por 1 kg. en frio","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":549.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0103","name":"Emulsificante y Estabilizante Laqua 10 por 500 grs. en frio","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0104","name":"Base Zero Aqua 1 kg.","brand":"Selecta","category":"Estabilizantes","supplierId":"arg","unitCost":549.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0105","name":"Cobertura Clásicas  1,3 kgs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":172.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0106","name":"Cobertura premium 1,3 kgs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":225.41,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0107","name":"Cobertura Clásicas  300 grs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":377.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0108","name":"Soft vainilla o chocolate por 1 kg.","brand":"Duas Rodas","category":"Food Service","supplierId":"arg","unitCost":270.49,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0109","name":"Chocolate caliente por 1 kg.","brand":"Duas Rodas","category":"Food Service","supplierId":"arg","unitCost":327.87,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0110","name":"Desmoldante Aerosol Lisse 600 ml","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":368.85,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0111","name":"Mejorador Enzipan 250","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":73.77,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0112","name":"Mix Pao de queijo por 1 kg.","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":172.13,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0113","name":"Caramelo Liquido 7 kg","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":139.34,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0114","name":"Lactofil Premium 1 L","brand":"Adimix","category":"Complementos Panadería","supplierId":"arg","unitCost":250.0,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0115","name":"Aceite Doratta 15,8 L (14, kgs)","brand":"Agropalma","category":"Aceites y Grasas","supplierId":"arg","unitCost":2250.0,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0116","name":"Grasa Palma 20 kgs","brand":"Agropalma","category":"Aceites y Grasas","supplierId":"arg","unitCost":122.73,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0117","name":"Anana 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0118","name":"Banana  3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0119","name":"Frambuesa 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0120","name":"Frutilla  3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":918.03,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0121","name":"Mango  3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0122","name":"Maracuyá 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0123","name":"Limón 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0124","name":"Azurro Cielo 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":799.18,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0125","name":"Bubbly 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1213.11,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0126","name":"Biscottino 4,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":995.9,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0127","name":"Biancocioc 6 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1090.16,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0128","name":"Cherry 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1122.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0129","name":"Cocco 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1032.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0130","name":"Caffe por 1 kg.","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":2991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0131","name":"Chantilly (pasta per cookies black) 4,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1086.07,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0132","name":"Cheese Cake en polvo 1 kg","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1295.083,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0133","name":"Limoncello en polvo con estabilizante 2,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":991.8,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0134","name":"Mascarpone en polvo 2 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1500.0,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0135","name":"Yoghin yogurth en polvo 1 kg","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1196.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0136","name":"Limone 50 en polvo con estabilizante 2,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1155.74,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0137","name":"Menta 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":952.82,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0138","name":"Mister Nico Pasta mani 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1180.33,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0139","name":"Pistacho California 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":4147.54,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0140","name":"Pistacho Pesto c/trozos 2,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":3581.97,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0141","name":"Nocciola Prima Fine (avellana) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":2151.64,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0142","name":"Nocciola Selection (avellana) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0143","name":"Nocciola Oscura (avellana) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1627.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0144","name":"Nocciola Máxima (kinder) 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":2340.16,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0145","name":"Sinfonía Italiana KIT 12,7 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0146","name":"Tiramisu 4,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1040.98,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0147","name":"Vainilla French 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1159.84,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0148","name":"Zabaione 5,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0149","name":"Cookie Black Oreo 6 kg","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0150","name":"Cookie Lemon 6 kg.","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0151","name":"Fiordibosco 3 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0152","name":"Mamá que buena kinder 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":967.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0153","name":"Mecralph 5,5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1254.1,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0154","name":"Mecrock 6 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1282.79,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0155","name":"Mecrock Plus 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1176.0,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0156","name":"Mister Nico Snickers 4 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":877.05,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0157","name":"Quello Caramelo 6 kg.","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0158","name":"Wafer 5 kgs","brand":"MEC3","category":"Pastas","supplierId":"eur","unitCost":1073.77,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0159","name":"Base Soave 2 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":831.97,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0160","name":"Base Elena 1,8 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":840.16,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0161","name":"Supergelmix 3 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":938.52,"unit":"lt","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0162","name":"Cioki 1 kg","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":655.74,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0163","name":"Cremfix 1 kg","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":643.44,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0164","name":"Cacao polvo 20-22","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":926.23,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0165","name":"Stracciatella","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":606.56,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0166","name":"Gianduia 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1311.48,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0167","name":"Torrone Rustico 4,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0168","name":"Frollino 5,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":926.23,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0169","name":"Amore Nocciola 5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":950.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0170","name":"Arancio Variegato 3,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":778.68,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0171","name":"Pistacho al Gusto 4 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1729.51,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0172","name":"Pistacho Natura 2,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":3950.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0173","name":"Pistacho Maestro 2,5","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":2983.61,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0174","name":"Morettina Clásica 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":696.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0175","name":"Morettina Blanca 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":696.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0176","name":"Morettina Pepita Clásica 5,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1172.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0177","name":"Morettina Pepita Blanca ,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1172.13,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0178","name":"Morettina Pistacho 6 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":1721.31,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0179","name":"Morettina Pastelera Clásica 12 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":614.75,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0180","name":"Morettina Pastelera Pistacho 5,5 kgs","brand":"Pernigotti","category":"Chocolates Gelatieri","supplierId":"eur","unitCost":942.62,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"General"},{"id":"p-0181","name":"Cacao polvo Namur 10 Kgs.","brand":"Duas Rodas","category":"Chocolates","supplierId":"arg","unitCost":491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0182","name":"Pasta Saborizante 2 kg.","brand":"Duas Rodas","category":"Pastas Saborizantes","supplierId":"arg","unitCost":491.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0183","name":"Dia & Light Vaniglia 1,25 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1159.84,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0184","name":"Dia & Light Fiordilatte 1,25 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1180.33,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0185","name":"Dia & Light Fuit 1 kg","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1098.36,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0186","name":"Dia & Light Cioccolatto 1,25 kgs","brand":"MEC3","category":"Bases","supplierId":"eur","unitCost":1295.08,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0187","name":"Chocolate Amargo Dark 70% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":844.26,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0188","name":"Chocolate Amargo Dark 70%  70% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0189","name":"Chocolate Amargo Black 65% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":844.26,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0190","name":"Chocolate s/Amargo 56% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":762.29,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0191","name":"Chocolate s/Amargo 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":688.52,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0192","name":"Chocolate s/Amargo 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":663.3,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0193","name":"Chocolate Fluido 56% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":991.8,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0194","name":"Chocolate Fluido 56% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":717.21,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0195","name":"Chocolate Fluido 56% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":696.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0196","name":"Chocolate c/Leche Caramelizado 40% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0197","name":"Chocolate c/Leche 35% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":872.95,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0198","name":"Chocolate c/Leche 35% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0199","name":"Chocolate c/Leche 35% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":786.89,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0200","name":"Chocolate Blanco c/Maiz 33% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":844.26,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0201","name":"Chocolate Blanco 31% 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":946.72,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0202","name":"Chocolate Blanco 31% 2,5 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":827.87,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0203","name":"Chocolate Blanco 31% 15 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":786.9,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0204","name":"Cacao Polvo 22-24% 2,25 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":926.23,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0205","name":"Nibs Cacao 1 kgs","brand":"Selecta","category":"Chocolates","supplierId":"arg","unitCost":1065.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0206","name":"Palitos Clásico enfajados 114x10x2mm por 10.000 (200x50 pcs)","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":2700.82,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0207","name":"Palitos Hélice enfajados 200x50 pcs 94x17-11x2 por 5.000 (100x50 pcs)","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":2573.77,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0208","name":"Palitos Redondo 160 x 6 mm  por 5.000","brand":"Ledevit","category":"Rellenos y Coberturas","supplierId":"arg","unitCost":3565.57,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Heladerias"},{"id":"p-0209","name":"Mix Cupcake vainilla 500 grs. (6 kgs)","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":233.61,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0210","name":"Mix Budín vainilla 500 grs. (6 kgs)","brand":"Ledevit","category":"Premezclas Horneables","supplierId":"arg","unitCost":213.11,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0211","name":"Cobertura Premium 1,3 kgs.","brand":"Duas Rodas","category":"Salsas y Coberturas","supplierId":"arg","unitCost":225.41,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0212","name":"Mousse Chantilly / Frutilla por 1 kg.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":573.77,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0213","name":"Mousse Chocolate por 1 kg.","brand":"Ledevit","category":"Premezclas Pasteleras","supplierId":"arg","unitCost":598.36,"unit":"kg","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0214","name":"AROMATIZANTES  1 lt. Chocolate, Coco, Manteca, Frutilla, Queso,Banana,Panettone","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":245.9,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"},{"id":"p-0215","name":"AROMATIZANTES  1 lt. Naranja, Limón, Menta , Banana","brand":"Duas Rodas","category":"Aromatizantes","supplierId":"arg","unitCost":360.65,"unit":"un","stock":0,"minStock":5,"dailyUsage":0.5,"source":"Horeca"}];

const IMP_BRAND_COLORS = {"Adimix":"#e8735a","Agropalma":"#7ab648","Duas Rodas / Mix":"#f4a700","Ledevit":"#5b9bd5","MEC3":"#c0392b","Norohy":"#8e44ad","Pernigotti":"#2c3e50","República del Cacao":"#6d4c41","SOSA":"#16a085","Selecta":"#e67e22","Tronador":"#2980b9"};
const IMP_SUP_LABEL = {"arg":"🇦🇷 Argentina / Brasil","ecu":"🇪🇨 Ecuador","eur":"🇪🇺 Europa"};
const IMP_SUP_COLOR = {"arg":"#2980b9","ecu":"#27ae60","eur":"#8e44ad"};

function ImporterTab({onDone}){
  const [step,setStep]=useState("select");
  const [sel,setSel]=useState(()=>Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));
  const [fb,setFb]=useState("all");
  const [fs,setFs]=useState("all");
  const [search,setSearch]=useState("");
  const [progress,setProgress]=useState(0);
  const [result,setResult]=useState(null);
  const existingCount=LS.get("aryes6-products",[]).length;

  const brands=["all",...Object.keys(IMP_BRAND_COLORS)];
  const suppliers=["all","arg","ecu","eur"];

  const filtered=LOVABLE_CATALOG.filter(p=>{
    const mb=fb==="all"||p.brand===fb;
    const ms=fs==="all"||p.supplierId===fs;
    const mq=!search||p.name.toLowerCase().includes(search.toLowerCase())||p.brand.toLowerCase().includes(search.toLowerCase())||p.category.toLowerCase().includes(search.toLowerCase());
    return mb&&ms&&mq;
  });

  const toggleSel=(id)=>setSel(prev=>({...prev,[id]:!prev[id]}));
  const selAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=true;});setSel(s);};
  const deselAll=()=>{const s={...sel};filtered.forEach(p=>{s[p.id]=false;});setSel(s);};
  const selAllCatalog=()=>setSel(Object.fromEntries(LOVABLE_CATALOG.map(p=>[p.id,true])));

  const selCount=Object.values(sel).filter(Boolean).length;
  const selProducts=LOVABLE_CATALOG.filter(p=>sel[p.id]);

  const doImport=async()=>{
    setStep("importing");
    const out=[];
    for(let i=0;i<selProducts.length;i++){
      setProgress(Math.round(((i+1)/selProducts.length)*100));
      await new Promise(r=>setTimeout(r,6));
      const p=selProducts[i];
      out.push({id:p.id,name:p.name,description:p.description,unitCost:p.unitCost,unit:p.unit,stock:p.stock,minStock:p.minStock||Math.max(5,Math.floor(p.stock/4)),supplierId:p.supplierId,brand:p.brand,category:p.category,dailyUsage:p.dailyUsage||0.5,createdAt:new Date().toISOString(),source:"lovable"});
    }
    LS.set("aryes6-products",out);
    setResult({total:out.length});
    setStep("done");
  };

  const pill=(active)=>({background:active?T.green:"#f0ece4",color:active?"#fff":T.textSm,border:"none",borderRadius:20,padding:"5px 13px",fontSize:12,cursor:"pointer",fontWeight:active?600:400,whiteSpace:"nowrap"});
  const byBrand=selProducts.reduce((a,p)=>{(a[p.brand]=a[p.brand]||[]).push(p);return a;},{});
  const bySup=selProducts.reduce((a,p)=>{a[p.supplierId]=(a[p.supplierId]||0)+1;return a;},{});

  if(step==="done")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:48,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:52,marginBottom:16}}>✅</div>
        <h2 style={{fontFamily:T.serif,fontSize:28,fontWeight:500,color:T.green,marginBottom:8}}>Inventario cargado</h2>
        <p style={{color:T.textSm,marginBottom:32}}>Los productos demo fueron eliminados y reemplazados por el catálogo real de Aryes</p>
        <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap",marginBottom:32}}>
          {[{n:result.total,l:"productos cargados",c:T.green},{n:11,l:"marcas",c:"#e67e22"},{n:3,l:"proveedores",c:"#8e44ad"}].map((s,i)=>(
            <div key={i} style={{background:T.cardWarm,borderRadius:10,padding:"16px 24px",textAlign:"center",minWidth:120}}>
              <div style={{fontSize:32,fontWeight:700,color:s.c}}>{s.n}</div>
              <div style={{color:T.textSm,fontSize:13}}>{s.l}</div>
            </div>
          ))}
        </div>
        <Btn onClick={onDone}>Ir al inventario →</Btn>
      </div>
    </div>
  );

  if(step==="importing")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
      <div style={{background:T.card,borderRadius:12,padding:64,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{fontSize:44,marginBottom:20}}>⏳</div>
        <h2 style={{fontFamily:T.serif,fontSize:26,fontWeight:500,color:T.text,marginBottom:6}}>Cargando inventario...</h2>
        <p style={{color:T.textSm,marginBottom:28,fontSize:14}}>{progress}% — {Math.round(selProducts.length*progress/100)} de {selProducts.length} productos</p>
        <div style={{background:T.muted,borderRadius:20,height:8,maxWidth:360,margin:"0 auto"}}>
          <div style={{background:T.green,borderRadius:20,height:8,width:`${progress}%`,transition:"width .15s"}}/>
        </div>
      </div>
    </div>
  );

  if(step==="preview")return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar</h1></div>
        <div style={{display:"flex",gap:10}}><Btn secondary onClick={()=>setStep("select")}>← Volver</Btn><Btn onClick={doImport}>✓ Cargar {selProducts.length} productos</Btn></div>
      </div>
      <div style={{background:"#fff8e1",border:"1px solid #ffe082",borderRadius:10,padding:"16px 20px"}}>
        <div style={{fontWeight:600,color:"#b45309",marginBottom:6}}>⚠ Se borrarán los productos demo</div>
        <div style={{fontSize:13,color:"#78350f"}}>El sistema tiene <strong>{existingCount}</strong> producto{existingCount!==1?"s":""} actualmente. Al confirmar, <strong>se eliminarán todos</strong> y se cargarán los {selProducts.length} productos seleccionados.</div>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:24}}>
          <div style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
            <div style={{fontSize:28,fontWeight:700,color:T.green}}>{selProducts.length}</div>
            <div style={{fontSize:12,color:T.textSm}}>a cargar</div>
          </div>
          {Object.entries(bySup).map(([s,c])=>(
            <div key={s} style={{background:T.cardWarm,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110}}>
              <div style={{fontSize:22,fontWeight:700,color:IMP_SUP_COLOR[s]}}>{c}</div>
              <div style={{fontSize:12,color:T.textSm}}>{IMP_SUP_LABEL[s]}</div>
            </div>
          ))}
        </div>
        <Cap style={{marginBottom:10}}>Desglose por marca</Cap>
        <div style={{maxHeight:320,overflow:"auto"}}>
          {Object.entries(byBrand).sort((a,b)=>b[1].length-a[1].length).map(([brand,prods])=>(
            <div key={brand} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.border}`}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:IMP_BRAND_COLORS[brand]||"#ccc",flexShrink:0}}/>
              <span style={{fontWeight:600,fontSize:14,flex:1}}>{brand}</span>
              <span style={{background:(IMP_BRAND_COLORS[brand]||"#888")+"18",color:IMP_BRAND_COLORS[brand]||"#888",borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}}>{prods.length} productos</span>
              <span style={{fontSize:12,color:IMP_SUP_COLOR[prods[0].supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prods[0].supplierId]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const visByBrand={};
  filtered.forEach(p=>{visByBrand[p.brand]=(visByBrand[p.brand]||0)+1;});

  return(
    <div className="au" style={{display:"grid",gap:24}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Importar catálogo</h1></div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {existingCount>0&&<span style={{fontSize:12,background:"#fff8e1",color:"#b45309",borderRadius:6,padding:"4px 10px"}}>⚠ {existingCount} productos actuales serán reemplazados</span>}
          <span style={{color:T.textSm,fontSize:13,fontWeight:600}}>{selCount} seleccionados</span>
          <Btn disabled={selCount===0} onClick={()=>setStep("preview")} style={{opacity:selCount===0?.4:1}}>Continuar →</Btn>
        </div>
      </div>
      <div style={{background:"#f0f7ed",borderRadius:10,padding:"14px 18px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",border:"1px solid #c8e0b8"}}>
        <span style={{fontSize:13,fontWeight:600,color:T.green}}>Selección rápida:</span>
        <Btn onClick={selAllCatalog}>★ Todos los 249 productos</Btn>
        <Btn secondary onClick={selAll}>✓ Visibles ({filtered.length})</Btn>
        <Btn secondary onClick={deselAll}>✕ Deseleccionar visibles</Btn>
      </div>
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
        <input placeholder="🔍 Buscar por nombre, marca o categoría..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"9px 14px",fontSize:13,background:T.cardWarm,width:"100%",marginBottom:12}}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Marca:</span>
          {brands.map(b=>(
            <button key={b} onClick={()=>setFb(b)} style={pill(fb===b)}>
              {b==="all"?"Todas":b}{b!=="all"&&visByBrand[b]?` (${visByBrand[b]})`:""}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:16}}>
          <span style={{fontSize:12,color:T.textSm,flexShrink:0}}>Proveedor:</span>
          {suppliers.map(s=>(
            <button key={s} onClick={()=>setFs(s)} style={pill(fs===s)}>
              {s==="all"?"Todos":IMP_SUP_LABEL[s]}</button>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,marginBottom:8}}>
          <span style={{fontSize:12,color:T.textSm}}>{filtered.length} productos · {selCount} seleccionados</span>
        </div>
        <div style={{maxHeight:480,overflow:"auto",display:"grid",gap:4}}>
          {filtered.map(prod=>{
            const isSel=!!sel[prod.id];
            return(
              <div key={prod.id} onClick={()=>toggleSel(prod.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 12px",borderRadius:8,background:isSel?"#f0f7ed":T.cardWarm,border:`1px solid ${isSel?T.green+"40":"transparent"}`,cursor:"pointer",transition:"all .12s"}}>
                <input type="checkbox" checked={isSel} onChange={()=>{}} style={{width:15,height:15,accentColor:T.green,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontWeight:600,fontSize:13,color:T.text}}>{prod.name}</span>
                    <span style={{background:(IMP_BRAND_COLORS[prod.brand]||"#888")+"18",color:IMP_BRAND_COLORS[prod.brand]||"#888",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:600}}>{prod.brand}</span>
                    <span style={{fontSize:11,color:T.textXs}}>{prod.category}</span>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{prod.unitCost>0?`$${prod.unitCost.toFixed(0)} / ${prod.unit}`:"—"}</div>
                  <div style={{fontSize:11,color:IMP_SUP_COLOR[prod.supplierId],fontWeight:500}}>{IMP_SUP_LABEL[prod.supplierId]}</div>
                </div>
              </div>
            );
          })}
          {filtered.length===0&&<div style={{textAlign:"center",padding:48,color:T.textXs}}>Sin resultados</div>}
        </div>
      </div>
    </div>
  );
}


const LoginScreen=({onLogin})=>{
  const [user,setUser]=useState('');
  const [pass,setPass]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const go=()=>{
    if(!user||!pass) return;
    setLoading(true);setErr('');
    setTimeout(()=>{
      const users=LS.get('aryes-users',USERS);
      const found=users.find(u=>u.username===user.trim()&&u.password===pass);
      if(found){onLogin(found);}else{setErr('Usuario o contraseña incorrectos');setLoading(false);}
    },350);
  };
  return(
    <div style={{minHeight:'100vh',background:'#f9f9f7',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:16,padding:'44px 40px',width:340,boxShadow:'0 4px 24px rgba(0,0,0,.07)'}}>
        <div style={{textAlign:'center',marginBottom:28}}>
          <img src={ARYES_LOGO_B64} height={44} alt="Aryes" style={{display:'block',margin:'0 auto 14px'}}/>
          <div style={{fontSize:11,letterSpacing:'.12em',color:'#6a6a68',fontWeight:600,textTransform:'uppercase'}}>Gestión de Stock · UY</div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,letterSpacing:'.08em',textTransform:'uppercase'}}>Usuario</label>
          <input value={user} onChange={e=>setUser(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} placeholder="usuario" autoFocus
            style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,letterSpacing:'.08em',textTransform:'uppercase'}}>Contraseña</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} placeholder="••••••••"
            style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
        </div>
        {err&&<div style={{color:'#dc2626',fontSize:12,marginBottom:14,textAlign:'center'}}>{err}</div>}
        <button onClick={go} disabled={loading||!user||!pass}
          style={{width:'100%',padding:'11px',background:(!user||!pass)?'#d0d0cc':'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontWeight:600,cursor:(!user||!pass)?'not-allowed':'pointer',fontFamily:'inherit',transition:'background .15s'}}>
          {loading?'Ingresando…':'Ingresar'}
        </button>
      </div>
    </div>
  );
};


const UsersTab=({session})=>{
  const [users,setUsers]=useState(()=>LS.get('aryes-users',USERS));
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState({username:'',password:'',name:'',role:'operador'});
  const [msg,setMsg]=useState('');

  const save=()=>{
    if(!form.username||!form.password||!form.name){setMsg('Completá todos los campos');return;}
    let updated;
    if(editing==='new'){
      if(users.find(u=>u.username===form.username)){setMsg('Ese usuario ya existe');return;}
      updated=[...users,{...form}];
    } else {
      updated=users.map(u=>u.username===editing?{...form}:u);
    }
    LS.set('aryes-users',updated); setUsers(updated); setEditing(null); setMsg('Guardado ✓');
    setTimeout(()=>setMsg(''),2000);
  };

  const del=(username)=>{
    if(username===session.username){setMsg('No podés eliminarte a vos mismo');return;}
    if(!confirm(`¿Eliminar usuario "${username}"?`)) return;
    const updated=users.filter(u=>u.username!==username);
    LS.set('aryes-users',updated); setUsers(updated);
  };

  const startEdit=(u)=>{ setForm({...u}); setEditing(u.username); setMsg(''); };
  const startNew=()=>{ setForm({username:'',password:'',name:'',role:'operador'}); setEditing('new'); setMsg(''); };

  const roleLabel=r=>r==='admin'?'Administrador':r==='operador'?'Operador':'Vendedor (solo lectura)';
  const roleColor=r=>r==='admin'?'#3a7d1e':r==='operador'?'#2563eb':'#9a9a98';

  return(
    <div style={{padding:'32px 40px',maxWidth:700}}>
      <div style={{marginBottom:28,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Configuración</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Usuarios</h1>
        </div>
        <button onClick={startNew} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Agregar usuario</button>
      </div>

      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}

      {/* User list */}
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:editing?24:0}}>
        {users.map(u=>(
          <div key={u.username} style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:38,height:38,borderRadius:'50%',background:'#f0f0ec',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>
                {u.role==='admin'?'👑':u.role==='operador'?'🔧':'👁'}
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:'#1a1a18'}}>{u.name}</div>
                <div style={{fontSize:12,color:'#9a9a98',marginTop:2}}>@{u.username} · <span style={{color:roleColor(u.role),fontWeight:500}}>{roleLabel(u.role)}</span></div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>startEdit(u)} style={{padding:'6px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
              {u.username!==session.username&&<button onClick={()=>del(u.username)} style={{padding:'6px 12px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Eliminar</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/New form */}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginTop:16}}>
          <h3 style={{fontSize:16,fontWeight:600,margin:'0 0 18px',color:'#1a1a18'}}>{editing==='new'?'Nuevo usuario':'Editar usuario'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Nombre completo</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Nombre de usuario</label>
              <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} disabled={editing!=='new'}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit',background:editing!=='new'?'#f5f5f3':'#fff'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Contraseña</label>
              <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'.07em'}}>Rol</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit',background:'#fff'}}>
                <option value="admin">Administrador (acceso total)</option>
                <option value="operador">Operador (stock y pedidos)</option>
                <option value="vendedor">Vendedor (solo lectura)</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{marginTop:24,padding:'14px 16px',background:'#f0f7ec',borderRadius:10,fontSize:12,color:'#5a7a4a'}}>
        <strong>Roles:</strong> Administrador puede hacer todo incluyendo gestionar usuarios · Operador puede actualizar stock y pedidos · Vendedor solo puede consultar
      </div>
    </div>
  );
};


// ── Lotes Tab ────────────────────────────────────────────────────────────
const LotsTab=({products,session})=>{
  const [lots,setLots]=useState(()=>LS.get('aryes-lots',[]));
  const [filter,setFilter]=useState('all');
  const [editing,setEditing]=useState(null);
  const [selProd,setSelProd]=useState('');
  const [form,setForm]=useState({lotNumber:'',quantity:'',expiryDate:'',notes:''});
  const [msg,setMsg]=useState('');
  const canEdit=session.role==='admin'||session.role==='operador';
  const today=new Date(); today.setHours(0,0,0,0);
  const daysTo=d=>Math.floor((new Date(d)-today)/86400000);
  const st=l=>!l.expiryDate?'ok':daysTo(l.expiryDate)<0?'expired':daysTo(l.expiryDate)<=30?'expiring':'ok';
  const stColor=s=>s==='expired'?'#dc2626':s==='expiring'?'#d97706':'#16a34a';
  const stBg=s=>s==='expired'?'#fef2f2':s==='expiring'?'#fffbeb':'#f0fdf4';
  const stLabel=s=>s==='expired'?'VENCIDO':s==='expiring'?'POR VENCER':'OK';
  const expired=lots.filter(l=>st(l)==='expired').length;
  const expiring=lots.filter(l=>st(l)==='expiring').length;
  const filtered=lots.filter(l=>filter==='all'?true:filter==='expiring'?st(l)!=='ok':st(l)==='expired');

  const save=()=>{
    if(!selProd||!form.lotNumber||!form.quantity){setMsg('Completá producto, lote y cantidad');return;}
    const prod=products.find(p=>String(p.id)===String(selProd));
    const lot={id:editing&&editing!=='new'?editing:'lot-'+Date.now(),productId:Number(selProd),productName:prod?.name||'',lotNumber:form.lotNumber,quantity:Number(form.quantity),expiryDate:form.expiryDate||null,entryDate:new Date().toISOString().split('T')[0],notes:form.notes};
    const updated=editing&&editing!=='new'?lots.map(l=>l.id===editing?lot:l):[...lots,lot];
    LS.set('aryes-lots',updated);setLots(updated);setEditing(null);setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');
    setMsg('Guardado ✓');setTimeout(()=>setMsg(''),2000);
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:860}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24}}>
        <div>
          <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Control de calidad</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Lotes y Vencimientos</h1>
        </div>
        {canEdit&&<button onClick={()=>{setEditing('new');setForm({lotNumber:'',quantity:'',expiryDate:'',notes:''});setSelProd('');}} style={{padding:'9px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>+ Registrar lote</button>}
      </div>
      {(expired>0||expiring>0)&&<div style={{display:'flex',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        {expired>0&&<div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>🚨</span><div><div style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>{expired} lote{expired>1?'s':''} vencido{expired>1?'s':''}</div><div style={{fontSize:11,color:'#9a9a98'}}>Revisar y dar de baja</div></div></div>}
        {expiring>0&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,padding:'12px 18px',display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:20}}>⚠️</span><div><div style={{fontSize:13,fontWeight:700,color:'#d97706'}}>{expiring} lote{expiring>1?'s':''} por vencer</div><div style={{fontSize:11,color:'#9a9a98'}}>Priorizar salida (FEFO)</div></div></div>}
      </div>}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['all','Todos',lots.length],['expiring','Por vencer',expired+expiring],['expired','Vencidos',expired]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:'7px 14px',background:filter===v?'#1a1a18':'#f0f0ec',color:filter===v?'#fff':'#6a6a68',border:'none',borderRadius:20,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>{l}{c>0&&' ('+c+')'}</button>
        ))}
      </div>
      {msg&&<div style={{padding:'10px 14px',background:msg.includes('✓')?'#f0f7ec':'#fef2f2',color:msg.includes('✓')?'#3a7d1e':'#dc2626',borderRadius:8,marginBottom:16,fontSize:13}}>{msg}</div>}
      {editing&&(
        <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:12,padding:24,marginBottom:20}}>
          <h3 style={{fontSize:15,fontWeight:600,margin:'0 0 16px'}}>{editing==='new'?'Nuevo lote':'Editar lote'}</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>Producto</label>
              <select value={selProd} onChange={e=>setSelProd(e.target.value)} style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,fontFamily:'inherit',background:'#fff'}}>
                <option value=''>Seleccionar...</option>
                {products.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.brand?p.brand+' — ':''}{p.name}</option>)}
              </select>
            </div>
            {[['Nº de lote','lotNumber','text','Ej: LOT-2024-001'],['Cantidad','quantity','number','0'],['Fecha vencimiento','expiryDate','date',''],['Notas','notes','text','Opcional']].map(([label,key,type,ph])=>(
              <div key={key}>
                <label style={{fontSize:11,fontWeight:600,color:'#6a6a68',display:'block',marginBottom:4,textTransform:'uppercase'}}>{label}</label>
                <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph}
                  style={{width:'100%',padding:'9px 12px',border:'1px solid #e2e2de',borderRadius:8,fontSize:14,boxSizing:'border-box',fontFamily:'inherit'}}/>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            <button onClick={save} style={{padding:'9px 20px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Guardar</button>
            <button onClick={()=>setEditing(null)} style={{padding:'9px 20px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
          </div>
        </div>
      )}
      {filtered.length===0?<div style={{textAlign:'center',padding:'48px 0',color:'#9a9a98'}}><div style={{fontSize:40,marginBottom:12}}>📦</div><div>{lots.length===0?'No hay lotes registrados':'Sin resultados en este filtro'}</div></div>:(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.sort((a,b)=>(!a.expiryDate?1:!b.expiryDate?-1:new Date(a.expiryDate)-new Date(b.expiryDate))).map(l=>{
            const s=st(l),d=l.expiryDate?daysTo(l.expiryDate):null;
            return <div key={l.id} style={{background:'#fff',border:'1px solid '+stColor(s)+'40',borderLeft:'4px solid '+stColor(s),borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:'#1a1a18'}}>{l.productName}</span>
                  <span style={{fontSize:11,background:stBg(s),color:stColor(s),padding:'2px 8px',borderRadius:10,fontWeight:600}}>{stLabel(s)}</span>
                </div>
                <div style={{display:'flex',gap:16,fontSize:12,color:'#6a6a68',flexWrap:'wrap'}}>
                  <span>Lote: <strong>{l.lotNumber}</strong></span>
                  <span>Cant: <strong>{l.quantity}</strong></span>
                  {l.expiryDate&&<span style={{color:stColor(s)}}>Vence: <strong>{l.expiryDate} ({d<0?Math.abs(d)+' días vencido':d+' días'})</strong></span>}
                  {l.notes&&<span>{l.notes}</span>}
                </div>
              </div>
              {canEdit&&<div style={{display:'flex',gap:8}}>
                <button onClick={()=>{setSelProd(String(l.productId));setForm({lotNumber:l.lotNumber,quantity:String(l.quantity),expiryDate:l.expiryDate||'',notes:l.notes||''});setEditing(l.id);}} style={{padding:'5px 12px',background:'#f0f0ec',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Editar</button>
                <button onClick={()=>{if(!confirm('¿Eliminar?'))return;const u=lots.filter(x=>x.id!==l.id);LS.set('aryes-lots',u);setLots(u);}} style={{padding:'5px 12px',background:'#fef2f2',color:'#dc2626',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✕</button>
              </div>}
            </div>;
          })}
        </div>
      )}
    </div>
  );
};

// ── Excel Importer Tab ───────────────────────────────────────────────────
const ExcelImportTab=({products,setProducts,session})=>{
  const [step,setStep]=useState('upload'); // upload | preview | done
  const [rows,setRows]=useState([]);
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);

  const parseCSV=(text)=>{
    const lines=text.split(/\r?\n/).filter(l=>l.trim());
    if(lines.length<2) return [];
    const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/['"]/g,''));
    return lines.slice(1).map(line=>{
      const vals=line.split(',').map(v=>v.trim().replace(/['"]/g,''));
      const obj={};
      headers.forEach((h,i)=>obj[h]=vals[i]||'');
      return obj;
    }).filter(r=>r.nombre||r.name||r.producto);
  };

  const mapRow=(r)=>({
    name: r.nombre||r.name||r.producto||'',
    brand: r.marca||r.brand||'',
    category: r.categoria||r.category||'',
    supplierId: (r.proveedor||r.supplier||'arg').toLowerCase().includes('ecu')?'ecu':(r.proveedor||r.supplier||'').toLowerCase().includes('eur')?'eur':'arg',
    unit: r.unidad||r.unit||'kg',
    stock: Number(r.stock||r.cantidad||0)||0,
    unitCost: Number((r.costo||r.precio_costo||r.price||r['precio costo']||'0').replace(/[^\d.]/g,''))||0,
    barcode: r.barcode||r.codigo||r['código']||'',
    minStock: Number(r.min_stock||r.stock_minimo||5)||5,
    dailyUsage: Number(r.uso_diario||r.daily_usage||0.5)||0.5,
  });

  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    setLoading(true);
    const text=await file.text();
    const parsed=parseCSV(text).map(mapRow).filter(r=>r.name);
    setRows(parsed);
    setStep(parsed.length>0?'preview':'upload');
    if(parsed.length===0) setMsg('No se encontraron productos. Verificá que el archivo sea CSV con columnas: nombre, marca, categoria, stock, costo');
    setLoading(false);
  };

  const applyImport=()=>{
    const maxId=products.reduce((m,p)=>Math.max(m,p.id),0);
    const newProds=rows.map((r,i)=>({...r,id:maxId+i+1,history:[]}));
    const updated=[...products,...newProds];
    LS.set('aryes6-products',updated);
    setProducts(updated);
    // Sync to Supabase
    const dbRows=newProds.map(p=>({id:p.id,name:p.name,barcode:p.barcode||'',supplier_id:p.supplierId,unit:p.unit,stock:p.stock,unit_cost:p.unitCost,min_stock:p.minStock,daily_usage:p.dailyUsage,category:p.category,brand:p.brand,history:[]}));
    db.upsert('products',dbRows).catch(e=>console.warn('sync:',e));
    setStep('done');
    setMsg(newProds.length+' productos importados correctamente ✓');
  };

  const downloadTemplate=()=>{
    const csv='nombre,marca,categoria,proveedor,unidad,stock,costo,barcode\nChocolate Cobertura Leche 1kg,Selecta,Chocolates,arg,kg,0,336.07,\nPasta Pistacho 1.5kg,MEC3,Gelato,eur,kg,0,1250,';
    const blob=new Blob([csv],{type:'text/csv'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='template_aryes.csv';a.click();
  };

  return(
    <div style={{padding:'32px 40px',maxWidth:800}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:11,letterSpacing:'.1em',color:'#9a9a98',fontWeight:600,textTransform:'uppercase',marginBottom:4}}>Carga masiva</div>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:36,fontWeight:500,color:'#1a1a18',margin:0}}>Importar Excel / CSV</h1>
      </div>

      {step==='upload'&&(
        <div>
          <div style={{background:'#fff',border:'2px dashed #e2e2de',borderRadius:12,padding:40,textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:48,marginBottom:12}}>📂</div>
            <div style={{fontSize:15,fontWeight:600,color:'#3a3a38',marginBottom:8}}>Subí tu archivo CSV</div>
            <div style={{fontSize:13,color:'#9a9a98',marginBottom:20}}>Exportá desde Excel como CSV y subilo acá</div>
            <label style={{padding:'10px 24px',background:'#3a7d1e',color:'#fff',borderRadius:8,fontSize:14,fontWeight:600,cursor:'pointer',display:'inline-block'}}>
              Elegir archivo
              <input type="file" accept=".csv,.txt" onChange={handleFile} style={{display:'none'}}/>
            </label>
            {loading&&<div style={{marginTop:16,color:'#9a9a98',fontSize:13}}>Procesando...</div>}
          </div>
          <div style={{background:'#f0f7ec',borderRadius:10,padding:'16px 20px',marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>Columnas aceptadas en el CSV:</div>
            <div style={{fontSize:12,color:'#5a7a4a',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>
              <span><strong>nombre</strong> — nombre del producto</span>
              <span><strong>marca</strong> — ej: Selecta, MEC3</span>
              <span><strong>categoria</strong> — ej: Chocolates</span>
              <span><strong>proveedor</strong> — arg / ecu / eur</span>
              <span><strong>unidad</strong> — kg / lt / u</span>
              <span><strong>stock</strong> — cantidad actual</span>
              <span><strong>costo</strong> — precio de costo</span>
              <span><strong>barcode</strong> — código de barras</span>
            </div>
          </div>
          <button onClick={downloadTemplate} style={{padding:'8px 16px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>⬇ Descargar template de ejemplo</button>
          {msg&&<div style={{marginTop:12,padding:'10px 14px',background:'#fef2f2',color:'#dc2626',borderRadius:8,fontSize:13}}>{msg}</div>}
        </div>
      )}

      {step==='preview'&&(
        <div>
          <div style={{background:'#f0f7ec',border:'1px solid #b8d9a8',borderRadius:10,padding:'12px 16px',marginBottom:20,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:14,color:'#3a7d1e',fontWeight:600}}>✓ {rows.length} productos detectados</span>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setStep('upload')} style={{padding:'7px 14px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>← Volver</button>
              <button onClick={applyImport} style={{padding:'7px 18px',background:'#3a7d1e',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Importar {rows.length} productos</button>
            </div>
          </div>
          <div style={{background:'#fff',border:'1px solid #e2e2de',borderRadius:10,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'#f9f9f7'}}>
                {['Nombre','Marca','Categoría','Proveedor','Unidad','Stock','Costo'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontWeight:600,color:'#6a6a68',fontSize:11,textTransform:'uppercase',letterSpacing:'.07em'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0,20).map((r,i)=><tr key={i} style={{borderTop:'1px solid #f0f0ec'}}>
                  <td style={{padding:'9px 14px',color:'#1a1a18',fontWeight:500}}>{r.name}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.brand||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.category||'—'}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.supplierId}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unit}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.stock}</td>
                  <td style={{padding:'9px 14px',color:'#6a6a68'}}>{r.unitCost}</td>
                </tr>)}
                {rows.length>20&&<tr><td colSpan={7} style={{padding:'9px 14px',color:'#9a9a98',fontSize:12,textAlign:'center'}}>... y {rows.length-20} más</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step==='done'&&(
        <div style={{textAlign:'center',padding:'48px 0'}}>
          <div style={{fontSize:56,marginBottom:16}}>✅</div>
          <div style={{fontSize:22,fontWeight:600,color:'#3a7d1e',marginBottom:8}}>{msg}</div>
          <div style={{fontSize:14,color:'#9a9a98',marginBottom:32}}>Los productos ya están disponibles en el inventario</div>
          <button onClick={()=>{setStep('upload');setRows([]);setMsg('');}} style={{padding:'10px 24px',background:'#f0f0ec',border:'none',borderRadius:8,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Importar otro archivo</button>
        </div>
      )}
    </div>
  );
};

export default function AryesApp(){
  const [session,setSession]=useState(()=>LS.get('aryes-session',null));
  const handleLogin=(u)=>{LS.set('aryes-session',u);setSession(u);};
  const handleLogout=()=>{LS.set('aryes-session',null);setSession(null);};
  if(!session) return <LoginScreen onLogin={handleLogin}/>;
  const canEdit=session.role==='admin'||session.role==='operador';

  const [dbReady,setDbReady]=useState(false);
  const [syncStatus,setSyncStatus]=useState('');
  useEffect(()=>{
    if(!session) return;
    setSyncStatus('sync');
    (async()=>{
      try{
        const prods=await db.get('products','order=id.asc&limit=1000');
        if(prods?.length>0){
          const mapped=prods.map(p=>({id:p.id,name:p.name,barcode:p.barcode||'',supplierId:p.supplier_id||'arg',unit:p.unit||'kg',stock:Number(p.stock)||0,unitCost:Number(p.unit_cost)||0,minStock:Number(p.min_stock)||5,dailyUsage:Number(p.daily_usage)||0.5,category:p.category||'',brand:p.brand||'',history:p.history||[]}));
          LS.set('aryes6-products',mapped);
        }
        const sups=await db.get('suppliers','order=name.asc');
        if(sups?.length>0){const mapped=sups.map(s=>({id:s.id,name:s.name,flag:s.flag||'',color:s.color||'#3a7d1e',times:s.times||{preparation:2,customs:1,freight:4,warehouse:1},company:s.company||'',contact:s.contact||'',email:s.email||'',phone:s.phone||'',country:s.country||'',city:s.city||'',currency:s.currency||'USD',paymentTerms:s.payment_terms||'30',paymentMethod:s.payment_method||'',minOrder:s.min_order||'',discount:s.discount||'0',rating:s.rating||3,active:s.active!==false,notes:s.notes||''}));LS.set('aryes6-suppliers',mapped);}
        const usrs=await db.get('users','order=id.asc');
        if(usrs?.length>0) LS.set('aryes-users',usrs.map(u=>({username:u.username,password:u.password,name:u.name,role:u.role,active:u.active})));
        setDbReady(true);setSyncStatus('ok');setTimeout(()=>setSyncStatus(''),3000);
      }catch(e){console.warn('Supabase offline, using local:',e);setDbReady(true);setSyncStatus('error');setTimeout(()=>setSyncStatus(''),4000);}
    })();
  },[session]);

  const [tab,setTab]=useState("dashboard");
  const [products,setProducts]=useState(()=>LS.get("aryes6-products",DEFAULT_PRODUCTS));
  const [suppliers,setSuppliers]=useState(()=>LS.get("aryes6-suppliers",DEFAULT_SUPPLIERS));
  const [orders,setOrders]=useState(()=>LS.get("aryes6-orders",[]));
  const [modal,setModal]=useState(null);
  const [editProd,setEditProd]=useState(null);
  const [editSup,setEditSup]=useState(null);
  const [viewSup,setViewSup]=useState(null);
  const [plans,setPlans]=useState(()=>LS.get("aryes7-plans",{}));
  const [movements,setMovements]=useState(()=>LS.get("aryes8-movements",[]));
  const [emailCfg,setEmailCfg]=useState(()=>LS.get("aryes9-emailcfg",{serviceId:"",templateId:"",publicKey:"",toEmail:"",enabled:false}));
  const [notified,setNotified]=useState(()=>LS.get("aryes9-notified",{}));

  useEffect(()=>LS.set("aryes6-products",products),[products]);
  useEffect(()=>LS.set("aryes6-suppliers",suppliers),[suppliers]);
  useEffect(()=>LS.set("aryes6-orders",orders),[orders]);
  useEffect(()=>LS.set("aryes7-plans",plans),[plans]);
  useEffect(()=>LS.set("aryes8-movements",movements),[movements]);
  useEffect(()=>LS.set("aryes9-emailcfg",emailCfg),[emailCfg]);
  useEffect(()=>LS.set("aryes9-notified",notified),[notified]);

  const getSup=id=>suppliers.find(s=>s.id===id);

  const enriched=useMemo(()=>products.map(p=>{const sup=getSup(p.supplierId);return{...p,sup,alert:alertLevel(p,sup)};}), [products,suppliers]);
  const alerts=enriched.filter(p=>p.alert.level!=="ok").sort((a,b)=>ALERT_CFG[b.alert.level].pri-ALERT_CFG[a.alert.level].pri);
  const critN=alerts.filter(p=>p.alert.level==="order_now").length;

  const saveProduct=f=>{
    if(editProd)setProducts(ps=>ps.map(p=>p.id===editProd.id?{...p,...f}:p));
    else setProducts(ps=>[...ps,{...f,id:Date.now()}]);
    setModal(null);setEditProd(null);
  };
  const confirmOrder=(product,qty)=>{
    const sup=getSup(product.supplierId);const lead=totalLead(sup);
    const arrival=new Date();arrival.setDate(arrival.getDate()+lead);
    const o={id:Date.now(),productId:product.id,productName:product.name,supplierId:product.supplierId,supplierName:sup?.name,qty,unit:product.unit,orderedAt:new Date().toISOString(),expectedArrival:arrival.toISOString(),status:"pending",totalCost:(qty*product.unitCost).toFixed(2),leadBreakdown:{...sup.times}};
    setOrders(os=>[o,...os]);
    addMov({type:"order_placed",productId:product.id,productName:product.name,supplierId:product.supplierId,supplierName:sup?.name,qty,unit:product.unit,note:`Pedido generado — llegada est. ${arrival.toLocaleDateString("es-UY",{day:"2-digit",month:"short",year:"numeric"})}`});
    setModal({type:"orderDone",order:o});
  };
  const markDelivered=id=>{
    const o=orders.find(x=>x.id===id);if(!o)return;
    setOrders(os=>os.map(x=>x.id===id?{...x,status:"delivered"}:x));
    const updatedProds = products.map(p=>p.id===o.productId?{...p,stock:p.stock+o.qty}:p);
    setProducts(()=>updatedProds);
    setTimeout(()=>checkAndNotify(updatedProds,suppliers,emailCfg,notified),500);
    addMov({type:"delivery",productId:o.productId,productName:o.productName,supplierId:o.supplierId,supplierName:o.supplierName,qty:o.qty,unit:o.unit,note:`Mercadería recibida — pedido del ${new Date(o.orderedAt).toLocaleDateString("es-UY",{day:"2-digit",month:"short"})}`});
  };
  const applyExcel=matches=>{
    const excelProds = products.map(p=>{const m=matches.find(x=>x.product.id===p.id);return m?{...p,stock:m.newStock}:p;});
    setProducts(()=>excelProds);
    setTimeout(()=>checkAndNotify(excelProds,suppliers,emailCfg,notified),500);
    matches.forEach(m=>{
      const diff=m.newStock-m.product.stock;
      addMov({type:diff>=0?"excel_in":"excel_out",productId:m.product.id,productName:m.product.name,supplierId:m.product.supplierId,supplierName:"",qty:Math.abs(diff),unit:m.product.unit,stockAfter:m.newStock,note:`Stock actualizado desde Excel (${diff>=0?"+":""}${diff})`});
    });
    setModal(null);
  };
  const saveSupplier=f=>{
    if(editSup)setSuppliers(ss=>ss.map(s=>s.id===editSup.id?{...s,...f}:s));
    else setSuppliers(ss=>[...ss,{...f,id:Date.now().toString()}]);
    setModal(null);setEditSup(null);
  };
  const deleteSupplier=id=>{
    if(products.some(p=>p.supplierId===id)){alert("No se puede eliminar: hay productos asociados a este proveedor.");return;}
    setSuppliers(ss=>ss.filter(s=>s.id!==id));
  };

  const sendAlertEmail = async (alertProducts, cfg) => {
    if(!cfg.enabled||!cfg.serviceId||!cfg.templateId||!cfg.publicKey||!cfg.toEmail) return;
    if(!alertProducts.length) return;
    try {
      const rows = alertProducts.map(p=>`
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px 14px;font-weight:600;">${p.name}</td>
          <td style="padding:10px 14px;color:#b91c1c;font-weight:700;">${p.alert.level==="order_now"?"🔴 PEDIR YA":"🟡 Pedir pronto"}</td>
          <td style="padding:10px 14px;">${p.stock} ${p.unit}</td>
          <td style="padding:10px 14px;">${p.alert.rop} ${p.unit}</td>
          <td style="padding:10px 14px;font-weight:600;">${p.alert.eoq||"—"} ${p.unit}</td>
        </tr>`).join("");
      const html = `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#2d5a1b;padding:20px 24px;">
          <h1 style="color:#fff;font-size:22px;margin:0;">Aryes — Alerta de Stock</h1>
          <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:13px;">${new Date().toLocaleDateString("es-UY",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
        </div>
        <div style="padding:20px 24px;background:#fef2f2;border-left:4px solid #b91c1c;">
          <p style="font-size:14px;color:#b91c1c;font-weight:700;margin:0;">${alertProducts.length} producto${alertProducts.length>1?"s requieren":"requiere"} atención inmediata</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:0;">
          <thead><tr style="background:#f5f0e8;">
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Producto</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Estado</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Stock actual</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Punto de pedido</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#7a7368;">Cantidad sugerida</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="padding:20px 24px;background:#f5f0e8;margin-top:20px;">
          <p style="font-size:12px;color:#7a7368;margin:0;">Este email fue enviado automáticamente por el sistema de gestión de stock de Aryes.</p>
        </div>
      </div>`;
      await fetch(`https://api.emailjs.com/api/v1.0/email/send`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          template_params: {
            to_email: cfg.toEmail,
            subject: `Aryes Stock — ${alertProducts.length} producto${alertProducts.length>1?"s":""}  ${alertProducts.some(p=>p.alert.level==="order_now")?"requieren pedido URGENTE":"requieren atención"}`,
            html_content: html,
            alert_count: alertProducts.length,
          }
        })
      });
    } catch(e){ console.warn("Email error:", e); }
  };

  const addMov=(m)=>setMovements(ms=>[{...m,id:Date.now(),ts:new Date().toISOString()},...ms].slice(0,2000));

  const checkAndNotify = (currentProducts, currentSuppliers, cfg, currentNotified) => {
    if(!cfg?.enabled) return;
    const toAlert = [];
    const newNotified = {...currentNotified};
    currentProducts.forEach(p => {
      const sup = currentSuppliers.find(s=>s.id===p.supplierId);
      const al = alertLevel(p, sup);
      const key = p.id;
      const shouldAlert = al.level==="order_now"||al.level==="order_soon";
      const alreadyNotified = currentNotified[key] === al.level;
      if(shouldAlert && !alreadyNotified){
        toAlert.push({...p, sup, alert:al});
        newNotified[key] = al.level;
      }
      if(!shouldAlert && currentNotified[key]){
        delete newNotified[key];
      }
    });
    if(toAlert.length > 0){
      setNotified(newNotified);
      sendAlertEmail(toAlert, cfg);
    }
  };

  const NAV=[{id:"dashboard",label:"Panel general"},{id:"products",label:"Inventario"},{id:"orders",label:"Pedidos"},{id:"suppliers",label:"Proveedores"},{id:"planning",label:"Planificación"},{id:"movements",label:"Movimientos"},{id:"scanner",label:"Scanner"},{id:"settings",label:"Configuración"},{id:"importer",label:"📦 Importar"},
  {id:"usuarios",label:"Usuarios",icon:"👤"}  ,{id:"lotes",label:"Lotes / Venc.",icon:"📅"}
  ,{id:"importar-excel",label:"Importar Excel",icon:"📊"}
];
  const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];

  return(
    <div style={{display:"flex",minHeight:"100vh",background:T.bg}}>
      <style>{CSS}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{width:220,background:T.card,borderRight:`1px solid ${T.border}`,position:"fixed",top:0,left:0,bottom:0,display:"flex",flexDirection:"column"}}>
        {/* Logo */}
        <div style={{padding:"22px 22px 18px",borderBottom:`1px solid ${T.border}`}}>
          <AryesLogo height={34}/>
          {syncStatus==='sync'&&<div style={{fontSize:10,color:'#9a9a98',marginTop:3}}>↻ Sincronizando...</div>}
          {syncStatus==='ok'&&<div style={{fontSize:10,color:'#3a7d1e',marginTop:3}}>✓ Sincronizado</div>}
          {syncStatus==='error'&&<div style={{fontSize:10,color:'#d97706',marginTop:3}}>⚠ Modo local</div>}
          <div style={{marginTop:6}}><Cap style={{color:T.green}}>Gestión de stock · UY</Cap></div>
        </div>

        {/* Nav */}
        <nav style={{padding:"14px 0",flex:1}}>
          {NAV.filter(n=>n.id!=="usuarios"||session.role==="admin").map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{width:"100%",textAlign:"left",padding:"10px 22px",background:"none",border:"none",borderLeft:tab===n.id?`3px solid ${T.green}`:"3px solid transparent",fontFamily:T.sans,fontSize:13,fontWeight:tab===n.id?600:400,color:tab===n.id?T.green:T.textSm,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {n.label}
              {n.id==="dashboard"&&critN>0&&<span style={{background:T.danger,color:"#fff",fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10}}>{critN}</span>}
            </button>
          ))}
        </nav>

        {/* Excel button */}
        <div style={{padding:"14px 16px",borderTop:`1px solid ${T.border}`}}>
          <button onClick={()=>setModal({type:"excel"})}
            style={{width:"100%",background:T.greenBg,border:`1px solid ${T.greenBd}`,borderRadius:4,padding:"9px 14px",fontFamily:T.sans,fontSize:11,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:T.green,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
            ↑ Actualizar stock
            <span style={{fontSize:10,color:T.greenLt,fontWeight:400}}>Excel</span>
          </button>
        </div>
      
        <div style={{marginTop:'auto',borderTop:'1px solid #e2e2de',padding:'12px 16px 8px'}}>
          <div style={{fontSize:12,color:'#3a3a38',fontWeight:600,marginBottom:2}}>{session.name}</div>
          <div style={{fontSize:11,color:'#9a9a98',marginBottom:8,textTransform:'capitalize'}}>{session.role==='admin'?'Administrador':session.role==='operador'?'Operador':'Vendedor'}</div>
          <button onClick={handleLogout} style={{background:'none',border:'none',padding:0,fontSize:12,color:'#dc2626',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
            ↩ Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{marginLeft:220,flex:1,padding:"36px 44px",minHeight:"100vh"}}>

        {/* ══ DASHBOARD ══ */}
        {tab==="dashboard"&&(
          <div className="au" style={{display:"grid",gap:32}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div>
                <Cap style={{color:T.green}}>Panel general</Cap>
                <h1 style={{fontFamily:T.serif,fontSize:42,fontWeight:500,color:T.text,marginTop:5,letterSpacing:"-.02em",lineHeight:1}}>
                  {new Date().toLocaleDateString("es-UY",{weekday:"long",day:"numeric",month:"long"})}
                </h1>
              </div>
              {critN>0&&(
                <div style={{background:T.dangerBg,border:`1px solid ${T.dangerBd}`,borderRadius:4,padding:"10px 16px",display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{width:8,height:8,borderRadius:"50%",background:T.danger,flexShrink:0,animation:"pulseDot 1.8s ease infinite"}}/>
                  <span style={{fontFamily:T.sans,fontSize:12,color:T.danger,fontWeight:700}}>{critN} PRODUCTO{critN>1?"S":""} REQUIERE{critN>1?"N":""} PEDIDO INMEDIATO</span>
                </div>
              )}
            </div>

            {/* Stat cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
              {[{l:"Total productos",v:products.length},{l:"Pedir ya",v:alerts.filter(p=>p.alert.level==="order_now").length,c:T.danger},{l:"Pedir pronto",v:alerts.filter(p=>p.alert.level==="order_soon").length,c:T.warning},{l:"En tránsito",v:orders.filter(o=>o.status==="pending").length,c:T.green}].map((s,i)=>(
                <div key={i} style={{background:T.card,padding:"20px 24px"}}>
                  <Cap>{s.l}</Cap>
                  <div style={{fontFamily:T.serif,fontSize:48,fontWeight:400,color:s.c||T.text,lineHeight:1,marginTop:8}}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Alerts */}
            {alerts.length>0?(
              <div>
                <div style={{marginBottom:12}}><Cap>Acciones requeridas</Cap></div>
                <div style={{display:"grid",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                  {alerts.map(({id,name,stock,unit,sup,alert})=>{
                    const ropDate=new Date();ropDate.setDate(ropDate.getDate()+alert.daysToROP);
                    return(
                      <div key={id} style={{background:T.card,padding:"15px 20px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                        <div style={{flex:1,minWidth:180}}>
                          <div style={{fontFamily:T.sans,fontSize:14,fontWeight:600,color:T.text}}>{name}</div>
                          <div style={{fontFamily:T.sans,fontSize:11,color:T.textSm,marginTop:2}}>[{sup?.flag}] {sup?.name} · Lead: {totalLead(sup)}d · ROP: {alert.rop} {unit} · {alert.daily.toFixed(1)}/día</div>
                          <div style={{marginTop:8,width:160}}><StockBar stock={stock} r={alert.rop} ss={alert.ss} max={Math.max(stock*1.6,alert.rop*2.5)}/></div>
                        </div>
                        <AlertPill level={alert.level}/>
                        <div style={{textAlign:"right",minWidth:120}}>
                          <Cap>{alert.level==="order_now"?"Pedir":"Pedir antes del"}</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:ALERT_CFG[alert.level].txt,marginTop:3}}>
                            {alert.level==="order_now"?"HOY":fmtDate(ropDate)}
                          </div>
                        </div>
                        <div style={{textAlign:"right",minWidth:80}}>
                          <Cap>EOQ sugerido</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:T.text,marginTop:3}}>{alert.eoq||"—"} {unit}</div>
                        </div>
                        <Btn small onClick={()=>setModal({type:"order",product:products.find(p=>p.id===id)})}>Generar pedido</Btn>
                      </div>
                    );
                  })}
                </div>
              </div>
            ):(
              <div style={{background:T.okBg,border:`1px solid ${T.okBd}`,borderRadius:6,padding:"16px 20px"}}>
                <p style={{fontFamily:T.sans,fontSize:13,color:T.ok,fontWeight:500}}>✓ Todo el inventario está dentro de parámetros. No hay acciones requeridas.</p>
              </div>
            )}

            {/* Supplier overview */}
            <div>
              <div style={{marginBottom:12}}><Cap>Estado por proveedor</Cap></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:1,background:T.border,borderRadius:8,overflow:"hidden"}}>
                {suppliers.map(sup=>{
                  const prods=enriched.filter(p=>p.supplierId===sup.id);
                  const now=prods.filter(p=>p.alert.level==="order_now").length;
                  const soon=prods.filter(p=>p.alert.level==="order_soon").length;
                  const pend=orders.filter(o=>o.supplierId===sup.id&&o.status==="pending").length;
                  return(
                    <div key={sup.id} style={{background:T.card,padding:"18px 22px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                        <div><Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap><div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:T.text,marginTop:3}}>{prods.length} producto{prods.length!==1?"s":""}</div></div>
                        <div style={{textAlign:"right"}}><Cap>Lead total</Cap><div style={{fontFamily:T.serif,fontSize:22,color:T.text,marginTop:3}}>{totalLead(sup)}d</div></div>
                      </div>
                      <div style={{display:"flex",gap:2,height:5,borderRadius:2,overflow:"hidden",marginBottom:8}}>
                        {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {now>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.danger,fontWeight:600}}>● {now} pedir ya</span>}
                        {soon>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.warning,fontWeight:600}}>● {soon} pedir pronto</span>}
                        {pend>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.watch,fontWeight:600}}>● {pend} en tránsito</span>}
                        {!now&&!soon&&!pend&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>✓ Normal</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ INVENTORY ══ */}
        {tab==="products"&&(
          <div className="au" style={{display:"grid",gap:22}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
              <div><Cap style={{color:T.green}}>Stock</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Inventario</h1></div>
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={()=>setModal({type:"excel"})} variant="ghost">↑ Importar Excel</Btn>
                <Btn onClick={()=>{setEditProd(null);setModal({type:"product"});}}>+ Nuevo producto</Btn>
              </div>
            </div>
            <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                  {["Producto","Proveedor","Stock","ROP","Safety","EOQ","/día","Tendencia","Lead","Estado",""].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {enriched.map(p=>(
                    <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                      onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                      <td style={{padding:"11px 13px"}}><div style={{fontFamily:T.sans,fontSize:13,fontWeight:600}}>{p.name}</div><div style={{fontFamily:"monospace",fontSize:10,color:T.textXs}}>{p.barcode||"—"}</div></td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>[{p.sup?.flag}] {p.sup?.name}</td>
                      <td style={{padding:"11px 13px"}}>
                        <div style={{fontFamily:T.sans,fontSize:13,fontWeight:700,color:p.stock<=(p.alert.rop||0)?T.danger:T.text}}>{p.stock} <span style={{fontWeight:400,color:T.textXs,fontSize:11}}>{p.unit}</span></div>
                        <div style={{marginTop:5,width:72}}><StockBar stock={p.stock} r={p.alert.rop} ss={p.alert.ss} max={Math.max(p.stock*1.6,p.alert.rop*2.5)}/></div>
                      </td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,fontWeight:600,color:T.textMd}}>{p.alert.rop>0?`${p.alert.rop} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.ss>0?`${p.alert.ss} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.eoq>0?`${p.alert.eoq} ${p.unit}`:"—"}</td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{p.alert.daily>0?`${p.alert.daily.toFixed(1)}`:"—"}</td>
                      <td style={{padding:"11px 13px"}}><Spark history={p.history} color={p.sup?.color||T.textXs}/></td>
                      <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{totalLead(p.sup)}d</td>
                      <td style={{padding:"11px 13px"}}><AlertPill level={p.alert.level}/></td>
                      <td style={{padding:"11px 13px"}}>
                        <div style={{display:"flex",gap:6}}>
                          <Btn small variant="ghost" onClick={()=>{setEditProd(products.find(x=>x.id===p.id));setModal({type:"product"});}}>Editar</Btn>
                          <Btn small onClick={()=>setModal({type:"order",product:products.find(x=>x.id===p.id)})}>Pedir</Btn>
                          <Btn small variant="danger" onClick={()=>setProducts(ps=>ps.filter(x=>x.id!==p.id))}>×</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ ORDERS ══ */}
        {tab==="orders"&&(
          <div className="au" style={{display:"grid",gap:22}}>
            <div><Cap style={{color:T.green}}>Historial</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Pedidos</h1></div>
            {!orders.length?(
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"48px 32px",textAlign:"center",background:T.card}}>
                <p style={{fontFamily:T.sans,fontSize:13,color:T.textSm}}>Sin pedidos aún. Generá uno desde el panel o el inventario.</p>
              </div>
            ):(
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                    {["Producto","Proveedor","Cantidad","Pedido","Llegada est.","Flete","Costo","Estado",""].map(h=><th key={h} style={{padding:"10px 13px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {orders.map(o=>{
                      const sup=getSup(o.supplierId);const pending=o.status==="pending";const bd=o.leadBreakdown;
                      return(
                        <tr key={o.id} style={{borderBottom:`1px solid ${T.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                          onMouseLeave={e=>e.currentTarget.style.background=T.card}>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600}}>{o.productName}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>[{sup?.flag}] {o.supplierName}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13}}>{o.qty} {o.unit}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{fmtShort(o.orderedAt)}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13,fontWeight:600,color:pending?T.watch:T.ok}}>{fmtDate(o.expectedArrival)}</td>
                          <td style={{padding:"11px 13px"}}>{bd&&<div style={{display:"flex",gap:1,height:6,width:72,borderRadius:2,overflow:"hidden"}}>{Object.values(bd).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.7}}/>)}</div>}</td>
                          <td style={{padding:"11px 13px",fontFamily:T.sans,fontSize:13}}>USD {o.totalCost}</td>
                          <td style={{padding:"11px 13px"}}><AlertPill level={pending?"watch":"ok"}/></td>
                          <td style={{padding:"11px 13px"}}>{pending&&<Btn small variant="success" onClick={()=>markDelivered(o.id)}>✓ Recibido</Btn>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══ SUPPLIERS ══ */}
        {tab==="suppliers"&&(
          <div className="au" style={{display:"grid",gap:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:10}}>
              <div>
                <Cap style={{color:T.green}}>Gestión</Cap>
                <h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Proveedores</h1>
              </div>
              <Btn onClick={()=>{setEditSup(null);setModal({type:"supplierForm"});}}>+ Nuevo proveedor</Btn>
            </div>

            {/* Supplier cards grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
              {suppliers.map(sup=>{
                const supProds=enriched.filter(p=>p.supplierId===sup.id);
                const alerts=supProds.filter(p=>p.alert.level!=="ok");
                const criticals=supProds.filter(p=>p.alert.level==="order_now");
                const pending=orders.filter(o=>o.supplierId===sup.id&&o.status==="pending");
                const totalSpent=orders.filter(o=>o.supplierId===sup.id&&o.status==="delivered").reduce((s,o)=>s+(+o.totalCost||0),0);
                const tfCols=["#3b82f6","#ef4444","#f59e0b","#10b981"];
                const tfs=["preparation","customs","freight","warehouse"];
                return(
                  <div key={sup.id} style={{background:T.card,border:`1px solid ${criticals.length>0?T.dangerBd:T.border}`,borderRadius:8,overflow:"hidden",transition:"box-shadow .2s"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.07)"}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>

                    {/* Card header */}
                    <div style={{padding:"16px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                          <span style={{background:sup.color+"22",color:sup.color,fontFamily:T.sans,fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:3}}>{sup.flag}</span>
                          <span style={{fontFamily:T.serif,fontSize:20,fontWeight:500,color:T.text}}>{sup.name}</span>
                        </div>
                        {sup.company&&<p style={{fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.company}</p>}
                        {sup.contact&&<p style={{fontFamily:T.sans,fontSize:11,color:T.textXs,marginTop:1}}>👤 {sup.contact}</p>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <Stars value={sup.rating||3}/>
                        <div style={{fontFamily:T.sans,fontSize:10,color:sup.active?T.ok:T.textXs,fontWeight:600,marginTop:4}}>{sup.active?"● Activo":"○ Inactivo"}</div>
                      </div>
                    </div>

                    {/* Lead time bar */}
                    <div style={{padding:"10px 18px",background:T.cardWarm,borderBottom:`1px solid ${T.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <Cap>Lead time</Cap>
                        <Cap style={{color:sup.color}}>{totalLead(sup)} días totales</Cap>
                      </div>
                      <div style={{display:"flex",gap:2,height:6,borderRadius:3,overflow:"hidden"}}>
                        {tfs.map((k,i)=><div key={k} style={{flex:sup.times[k]||0.1,background:tfCols[i],opacity:.75}}/>)}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:T.border}}>
                      {[
                        {l:"Productos",v:supProds.length},
                        {l:"En tránsito",v:pending.length,c:pending.length>0?T.watch:T.textSm},
                        {l:"Comprado",v:`${sup.currency||"USD"} ${totalSpent.toFixed(0)}`},
                      ].map((s,i)=>(
                        <div key={i} style={{background:T.card,padding:"10px 12px",textAlign:"center"}}>
                          <Cap>{s.l}</Cap>
                          <div style={{fontFamily:T.serif,fontSize:18,fontWeight:500,color:s.c||T.text,marginTop:3}}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Alert strip */}
                    {criticals.length>0&&(
                      <div style={{padding:"8px 18px",background:T.dangerBg,borderTop:`1px solid ${T.dangerBd}`}}>
                        <p style={{fontFamily:T.sans,fontSize:11,color:T.danger,fontWeight:600}}>
                          ● {criticals.length} producto{criticals.length>1?"s requieren":"requiere"} pedido inmediato: {criticals.map(p=>p.name).join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Commercial conditions summary */}
                    <div style={{padding:"10px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:12,flexWrap:"wrap"}}>
                      {sup.paymentTerms&&<span style={{fontFamily:T.sans,fontSize:11,color:T.textSm}}>💳 {sup.paymentTerms}d pago</span>}
                      {sup.minOrder>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.textSm}}>📦 Min. {sup.currency||"USD"} {sup.minOrder}</span>}
                      {sup.discount>0&&<span style={{fontFamily:T.sans,fontSize:11,color:T.ok}}>🏷️ {sup.discount}% dto.</span>}
                      {sup.email&&<a href={"mailto:"+sup.email} style={{fontFamily:T.sans,fontSize:11,color:T.green,textDecoration:"none"}}>✉️ Email</a>}
                      {sup.whatsapp&&<a href={"https://wa.me/"+sup.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontFamily:T.sans,fontSize:11,color:"#16a34a",textDecoration:"none"}}>💬 WhatsApp</a>}
                    </div>

                    {/* Actions */}
                    <div style={{padding:"12px 18px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
                      <Btn small full onClick={()=>setViewSup(sup)}>Ver detalle</Btn>
                      <Btn small variant="ghost" onClick={()=>{setEditSup(sup);setModal({type:"supplierForm"});}}>Editar</Btn>
                      <Btn small variant="danger" onClick={()=>deleteSupplier(sup.id)}>×</Btn>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global lead time comparison table */}
            <div>
              <div style={{marginBottom:10}}><Cap>Comparativa de tiempos y condiciones</Cap></div>
              <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"auto",background:T.card}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:T.muted,borderBottom:`1px solid ${T.border}`}}>
                    {["Proveedor","Prep.","Aduana","Flete","Depósito","Total","Moneda","Pago","Mín.","Dto.","Calif."].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"left",fontFamily:T.sans,fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:T.textSm,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {suppliers.map(sup=>(
                      <tr key={sup.id} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=T.cardWarm}
                        onMouseLeave={e=>e.currentTarget.style.background=T.card}
                        onClick={()=>setViewSup(sup)}>
                        <td style={{padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{background:sup.color+"22",color:sup.color,fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:2}}>{sup.flag}</span>
                            <span style={{fontFamily:T.sans,fontSize:13,fontWeight:600}}>{sup.name}</span>
                          </div>
                        </td>
                        {["preparation","customs","freight","warehouse"].map(k=>(
                          <td key={k} style={{padding:"10px 12px",fontFamily:T.sans,fontSize:13,color:T.textMd,textAlign:"center"}}>{sup.times[k]}d</td>
                        ))}
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:13,fontWeight:700,color:sup.color,textAlign:"center"}}>{totalLead(sup)}d</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.currency||"USD"}</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.paymentTerms||"—"}d</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:T.textSm}}>{sup.minOrder>0?`${sup.minOrder}`:"—"}</td>
                        <td style={{padding:"10px 12px",fontFamily:T.sans,fontSize:12,color:sup.discount>0?T.ok:T.textSm,fontWeight:sup.discount>0?600:400}}>{sup.discount>0?`${sup.discount}%`:"—"}</td>
                        <td style={{padding:"10px 12px"}}><Stars value={sup.rating||3}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ PLANNING ══ */}
        {tab==="planning"&&(
          <div className="au">
            <PlanningView products={products} suppliers={suppliers} orders={orders} plans={plans} setPlans={setPlans}/>
          </div>
        )}

        {/* ══ MOVEMENTS ══ */}
        {tab==="movements"&&(
          <div className="au">
            <MovementsView
              movements={movements}
              products={products}
              suppliers={suppliers}
              onAddManual={m=>{
                addMov(m);
                if(m.type==="manual_in") setProducts(ps=>ps.map(p=>p.id===m.productId?{...p,stock:p.stock+m.qty}:p));
                else if(m.type==="manual_out") setProducts(ps=>ps.map(p=>p.id===m.productId?{...p,stock:Math.max(0,p.stock-m.qty)}:p));
              }}
            />
          </div>
        )}

        {/* ══ SCANNER ══ */}
        {tab==="scanner"&&<div className="au"><Scanner products={products} suppliers={suppliers} onUpdate={(id,qty,name,unit)=>{const p2=products.find(p=>p.id===id);const sup2=p2?suppliers.find(s=>s.id===p2.supplierId):null;setProducts(ps=>ps.map(p=>p.id===id?{...p,stock:p.stock+qty}:p));addMov({type:"scanner_in",productId:id,productName:name||p2?.name||id,supplierId:p2?.supplierId||"",supplierName:sup2?.name||"",qty,unit:unit||p2?.unit||"",note:"Ingreso por scanner"});}}/></div>}

        {/* ══ SETTINGS ══ */}
        {tab==="settings"&&(
          <div className="au" style={{display:"grid",gap:24}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}>
              <div><Cap style={{color:T.green}}>Sistema</Cap><h1 style={{fontFamily:T.serif,fontSize:40,fontWeight:500,color:T.text,marginTop:4,letterSpacing:"-.02em"}}>Configuración</h1></div>
            </div>
            {/* Settings sub-tabs */}
            {(()=>{
              const [settingsTab,setSettingsTab]=useState("freight");
              return(
                <div>
                  <div style={{display:"flex",gap:1,background:T.border,borderRadius:6,overflow:"hidden",maxWidth:400,marginBottom:24}}>
                    {[{id:"freight",l:"Tiempos de flete"},{id:"email",l:"Notificaciones email"}].map(st=>(
                      <button key={st.id} onClick={()=>setSettingsTab(st.id)}
                        style={{flex:1,padding:"10px 16px",border:"none",cursor:"pointer",fontFamily:T.sans,fontSize:12,fontWeight:600,
                          background:settingsTab===st.id?T.green:T.card,color:settingsTab===st.id?"#fff":T.textSm}}>
                        {st.l}
                      </button>
                    ))}
                  </div>
                  {settingsTab==="freight"&&(
                    <div style={{maxWidth:680}}>
                      <p style={{fontFamily:T.sans,fontSize:12,color:T.textSm,marginBottom:16,lineHeight:1.6}}>Estos valores determinan el ROP (punto de pedido). Actualizalos cuando cambien las condiciones logísticas.</p>
                      {suppliers.map(sup=>(
                        <div key={sup.id} style={{border:`1px solid ${T.border}`,borderRadius:8,marginBottom:8,overflow:"hidden"}}>
                          <div style={{padding:"12px 18px",background:T.muted,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <Cap style={{color:sup.color}}>[{sup.flag}] {sup.name}</Cap>
                            <Cap>Total: {totalLead(sup)} días</Cap>
                          </div>
                          <div style={{padding:"14px 18px",background:T.card}}>
                            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
                              {[["preparation","Preparación"],["customs","Aduana"],["freight","Flete"],["warehouse","Depósito"]].map(([k,l])=>(
                                <Field key={k} label={l}>
                                  <div style={{display:"flex",gap:6,alignItems:"center",marginTop:5}}>
                                    <Inp type="number" min="0" value={sup.times[k]} onChange={e=>setSuppliers(ss=>ss.map(s=>s.id===sup.id?{...s,times:{...s.times,[k]:Math.max(0,+e.target.value)}}:s))} style={{textAlign:"center"}}/>
                                    <span style={{fontFamily:T.sans,fontSize:11,color:T.textXs}}>d</span>
                                  </div>
                                </Field>
                              ))}
                            </div>
                            <div style={{display:"flex",gap:2,height:5,borderRadius:2,overflow:"hidden",marginTop:12}}>
                              {Object.values(sup.times).map((v,i)=><div key={i} style={{flex:v||.1,background:tfCols[i],opacity:.65}}/>)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {settingsTab==="email"&&(
                    <EmailSettings
                      cfg={emailCfg}
                      setCfg={setEmailCfg}
                      enriched={enriched}
                      onTestSend={()=>{}}
                      onManualSend={(prods)=>sendAlertEmail(prods,emailCfg)}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══ IMPORTER ══ */}
        {tab==="importer"&&<ImporterTab onDone={()=>{setProducts(LS.get("aryes6-products",[]));setTab("products");}}/>}
      </main>

      {/* ══ MODALS ══ */}
      {modal?.type==="product"&&<Modal title={editProd?"Editar producto":"Nuevo producto"} sub="Inventario" onClose={()=>{setModal(null);setEditProd(null);}}><ProductForm product={editProd} suppliers={suppliers} onSave={saveProduct} onClose={()=>{setModal(null);setEditProd(null);}}/></Modal>}
      {modal?.type==="order"&&<OrderModal product={modal.product} supplier={getSup(modal.product.supplierId)} onConfirm={qty=>confirmOrder(modal.product,qty)} onClose={()=>setModal(null)}/>}
      {modal?.type==="orderDone"&&(
        <Modal title={modal.order.productName} sub="Pedido registrado correctamente" onClose={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:T.border,borderRadius:6,overflow:"hidden",marginBottom:20}}>
            {[{l:"Cantidad",v:`${modal.order.qty} ${modal.order.unit}`},{l:"Costo estimado",v:`USD ${modal.order.totalCost}`},{l:"Fecha pedido",v:fmtDate(modal.order.orderedAt)},{l:"Llegada estimada",v:fmtDate(modal.order.expectedArrival)}].map((s,i)=>(
              <div key={i} style={{background:T.cardWarm,padding:"14px 16px"}}>
                <Cap>{s.l}</Cap>
                <div style={{fontFamily:T.serif,fontSize:22,fontWeight:500,color:T.text,marginTop:5}}>{s.v}</div>
              </div>
            ))}
          </div>
          <Btn onClick={()=>setModal(null)} full>Entendido</Btn>
        </Modal>
      )}
      {modal?.type==="excel"&&<ExcelModal products={products} onApply={applyExcel} onClose={()=>setModal(null)}/>}
      {modal?.type==="supplierForm"&&(
        <Modal title={editSup?"Editar proveedor":"Nuevo proveedor"} sub="Proveedores" onClose={()=>{setModal(null);setEditSup(null);}} wide>
          <SupplierForm supplier={editSup} onSave={saveSupplier} onClose={()=>{setModal(null);setEditSup(null);}}/>
        </Modal>
      )}
      {viewSup&&(
        <SupplierDetail
          supplier={viewSup}
          products={products}
          orders={orders}
          onEdit={()=>{setEditSup(viewSup);setViewSup(null);setModal({type:"supplierForm"});}}
          onClose={()=>setViewSup(null)}
        />
      )}
    </div>
  );
}
