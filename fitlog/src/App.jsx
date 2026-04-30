import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from "recharts";

const STORAGE_KEYS = {
  workouts: "fitlog_workouts",
  nutrition: "fitlog_nutrition",
  bodyweight: "fitlog_bodyweight",
  goals: "fitlog_goals",
  templates: "fitlog_templates",
  exerciseMap: "fitlog_exercise_map",
  customFoods: "fitlog_custom_foods",
};

const DEFAULT_GOALS = { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, carbFatSplit: 60 };

const today = () => new Date().toISOString().split("T")[0];
const last7Days = () => { const d=[]; for(let i=6;i>=0;i--){const x=new Date();x.setDate(x.getDate()-i);d.push(x.toISOString().split("T")[0]);}return d; };
const shortDate = iso => { const dt=new Date(iso+"T12:00:00"); return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()]} ${dt.getDate()}`; };
function calcMacros(calories,protein_g,carbPct){const rem=Math.max(0,calories-protein_g*4);return{carbs_g:Math.round(rem*(carbPct/100)/4),fat_g:Math.round(rem*((100-carbPct)/100)/9)};}
function load(key,fb){try{return JSON.parse(localStorage.getItem(key))??fb;}catch{return fb;}}
function save(key,data){localStorage.setItem(key,JSON.stringify(data));}

const HARD_ALIASES = {
  "bench":"bench press","barbell bench":"bench press","flat bench":"bench press","bb bench":"bench press","chest press":"bench press",
  "incline":"incline bench press","incline bench":"incline bench press","incline press":"incline bench press",
  "ohp":"overhead press","military press":"overhead press","shoulder press":"overhead press","standing press":"overhead press",
  "squat":"squat","squats":"squat","barbell squat":"squat","back squat":"squat",
  "deadlift":"deadlift","deadlifts":"deadlift","dl":"deadlift","conventional deadlift":"deadlift",
  "rdl":"romanian deadlift","stiff leg deadlift":"romanian deadlift",
  "row":"barbell row","bent over row":"barbell row","pendlay row":"barbell row",
  "pullup":"pull-up","pull up":"pull-up","chin up":"chin-up","chinup":"chin-up",
  "lat pulldown":"lat pulldown","lat pull-down":"lat pulldown","pulldown":"lat pulldown",
  "curl":"bicep curl","bicep curls":"bicep curl","barbell curl":"bicep curl","curls":"bicep curl",
  "tricep extension":"tricep extension","skullcrusher":"skullcrusher","skull crusher":"skullcrusher",
  "lunge":"lunge","lunges":"lunge","dip":"dip","dips":"dip",
};

function tokenize(s){return s.toLowerCase().replace(/[^a-z0-9 ]/g,"").split(/\s+/).filter(Boolean);}
function wordOverlapScore(a,b){const ta=new Set(tokenize(a)),tb=new Set(tokenize(b));const i=[...ta].filter(t=>tb.has(t)).length,u=new Set([...ta,...tb]).size;return u===0?0:i/u;}
function levenshtein(a,b){const m=a.length,n=b.length,dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);return dp[m][n];}
function similarityScore(a,b){const ov=wordOverlapScore(a,b),ml=Math.max(a.length,b.length),ed=ml===0?1:1-levenshtein(a.toLowerCase(),b.toLowerCase())/ml;return ov*0.7+ed*0.3;}
function findSimilarExercise(incoming,known,threshold=0.45){let best=null,bs=threshold;for(const k of known){const s=similarityScore(incoming.toLowerCase(),k.toLowerCase());if(s>bs){bs=s;best=k;}}return best;}

const C={bg:"#080d16",surface:"#0f1623",border:"#1a2535",text:"#e2e8f0",muted:"#4a5568",accent:"#22d3ee",green:"#10b981",amber:"#f59e0b",purple:"#a78bfa",orange:"#fb923c",red:"#f87171"};
const card={background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:12};
const ctitle={fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,marginBottom:12};
const rowSt={display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,padding:"5px 0",borderBottom:`1px solid ${C.border}`};
const inp={background:"#111827",border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};
function progressColor(pct){if(pct>=105)return C.red;if(pct>=90)return C.amber;return C.green;}

// ── Delete button ─────────────────────────────────────────────────────────────
function DeleteBtn({ onDelete, style = {} }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef(null);

  function handleClick(e) {
    e.stopPropagation();
    if (confirming) {
      clearTimeout(timerRef.current);
      setConfirming(false);
      onDelete();
    } else {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 2500);
    }
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <button
      onClick={handleClick}
      title={confirming ? "Tap again to confirm" : "Delete"}
      style={{
        background: confirming ? C.red : "none",
        border: `1px solid ${confirming ? C.red : C.border}`,
        borderRadius: 6,
        padding: "3px 8px",
        color: confirming ? "#fff" : C.muted,
        fontSize: 11,
        fontFamily: "inherit",
        fontWeight: confirming ? 700 : 400,
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 0.15s",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {confirming ? "confirm?" : "✕"}
    </button>
  );
}

// ── Confirm label scan before logging ────────────────────────────────────────
function LabelConfirmModal({scanned, onConfirm, onCancel}){
  const[servings,setServings]=useState("1");
  const mult=parseFloat(servings)||1;
  const scaled={
    name:scanned.name,
    calories:Math.round(scanned.calories*mult),
    protein_g:Math.round(scanned.protein_g*mult),
    carbs_g:Math.round(scanned.carbs_g*mult),
    fat_g:Math.round(scanned.fat_g*mult),
    quantity:`${servings} serving${mult!==1?"s":""}`,
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.accent}`,borderRadius:16,padding:22,width:"100%",maxWidth:400}}>
        <div style={{fontSize:12,color:C.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Label Scanned ✓</div>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:14,textTransform:"capitalize"}}>{scanned.name}</div>
        <div style={{background:"#0a0f1a",borderRadius:10,padding:12,marginBottom:14}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:8,letterSpacing:"0.06em"}}>PER SERVING</div>
          {[["Calories",scanned.calories,"cal",C.amber],["Protein",scanned.protein_g,"g",C.accent],["Carbs",scanned.carbs_g,"g",C.purple],["Fat",scanned.fat_g,"g",C.orange]].map(([l,v,u,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"3px 0"}}>
              <span style={{color:C.muted}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}{u}</span>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:6}}>How many servings?</label>
          <input style={{...inp,textAlign:"center",fontSize:16,fontWeight:700}} type="number" step="0.5" min="0.5" value={servings} onChange={e=>setServings(e.target.value)}/>
        </div>
        {mult!==1&&(
          <div style={{background:"#0a0f1a",borderRadius:10,padding:10,marginBottom:14}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:6}}>TOTAL ({servings} servings)</div>
            {[["Calories",scaled.calories,"cal",C.amber],["Protein",scaled.protein_g,"g",C.accent],["Carbs",scaled.carbs_g,"g",C.purple],["Fat",scaled.fat_g,"g",C.orange]].map(([l,v,u,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"2px 0"}}>
                <span style={{color:C.muted}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}{u}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <button style={{flex:1,background:C.green,border:"none",borderRadius:10,padding:"12px 0",color:C.bg,fontWeight:700,fontFamily:"inherit",fontSize:13,cursor:"pointer"}} onClick={()=>onConfirm(scaled)}>Log It</button>
          <button style={{flex:1,background:"none",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 0",color:C.muted,fontWeight:700,fontFamily:"inherit",fontSize:13,cursor:"pointer"}} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Exercise confirm modal ────────────────────────────────────────────────────
function ExerciseConfirmModal({incoming,existing,onSame,onDifferent}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.surface,border:`1px solid ${C.accent}`,borderRadius:16,padding:24,width:"100%",maxWidth:400}}>
        <div style={{fontSize:12,color:C.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Same Exercise?</div>
        <div style={{fontSize:14,color:C.text,lineHeight:1.6,marginBottom:20}}>
          You logged <span style={{color:C.amber,fontWeight:700}}>"{incoming}"</span> — is this the same as <span style={{color:C.green,fontWeight:700}}>"{existing}"</span> already in your library?
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={{flex:1,background:C.green,border:"none",borderRadius:10,padding:"12px 0",color:C.bg,fontWeight:700,fontFamily:"inherit",fontSize:13,cursor:"pointer"}} onClick={onSame}>✓ Yes, same</button>
          <button style={{flex:1,background:"none",border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 0",color:C.text,fontWeight:700,fontFamily:"inherit",fontSize:13,cursor:"pointer"}} onClick={onDifferent}>No, different</button>
        </div>
      </div>
    </div>
  );
}

// ── Save new food prompt ──────────────────────────────────────────────────────
function SaveFoodPrompt({food, onSave, onSkip}){
  return(
    <div style={{...card,border:`1px solid ${C.amber}`,marginTop:-4}}>
      <div style={{fontSize:12,color:C.amber,fontWeight:700,marginBottom:8}}>Save "{food.name}" to your Foods library?</div>
      <div style={{fontSize:11,color:C.muted,marginBottom:12}}>{food.calories}cal · {food.protein_g}g pro · {food.carbs_g}g carbs · {food.fat_g}g fat per serving</div>
      <div style={{display:"flex",gap:8}}>
        <button style={{flex:1,background:C.amber,border:"none",borderRadius:8,padding:"8px 0",color:C.bg,fontWeight:700,fontFamily:"inherit",fontSize:12,cursor:"pointer"}} onClick={onSave}>Save it</button>
        <button style={{flex:1,background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 0",color:C.muted,fontFamily:"inherit",fontSize:12,cursor:"pointer"}} onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}

function CalorieRing({consumed,goal}){
  const pct=goal>0?consumed/goal:0,over=pct>1,R=72,stroke=11,norm=2*Math.PI*R;
  const filled=Math.min(pct,1)*norm,overArc=over?Math.min((pct-1),1)*norm:0;
  const color=progressColor(pct*100),remaining=Math.max(0,goal-consumed);
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"8px 0 4px"}}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={90} cy={90} r={R} fill="none" stroke="#1a2535" strokeWidth={stroke}/>
        {filled>0&&<circle cx={90} cy={90} r={R} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${filled} ${norm}`} strokeDashoffset={norm*0.25} strokeLinecap="round" style={{transition:"stroke-dasharray 0.5s ease,stroke 0.4s ease"}}/>}
        {over&&overArc>0&&<circle cx={90} cy={90} r={R} fill="none" stroke={C.red} strokeWidth={stroke} opacity={0.7} strokeDasharray={`${overArc} ${norm}`} strokeDashoffset={norm*0.25} strokeLinecap="round"/>}
        <text x={90} y={82} textAnchor="middle" fill={color} fontSize={28} fontWeight={700} fontFamily="IBM Plex Mono,monospace" style={{transition:"fill 0.4s"}}>{consumed}</text>
        <text x={90} y={100} textAnchor="middle" fill={C.muted} fontSize={11} fontFamily="IBM Plex Mono,monospace">of {goal} cal</text>
        <text x={90} y={116} textAnchor="middle" fill={over?C.red:C.muted} fontSize={11} fontFamily="IBM Plex Mono,monospace">{over?`${consumed-goal} over`:`${remaining} left`}</text>
      </svg>
    </div>
  );
}

function MacroBar({label,value,goal}){
  const pct=goal>0?(value/goal)*100:0,capped=Math.min(pct,100),over=pct>100,barColor=progressColor(pct);
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
        <span style={{fontSize:12,fontWeight:700,color:C.text,letterSpacing:"0.04em"}}>{label}</span>
        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
          <span style={{fontSize:18,fontWeight:700,color:barColor,transition:"color 0.3s"}}>{Math.round(value)}</span>
          <span style={{fontSize:11,color:C.muted}}>/ {goal}g</span>
          {over&&<span style={{fontSize:10,fontWeight:700,color:C.red,background:"#2d0f0f",padding:"1px 6px",borderRadius:4}}>+{Math.round(value-goal)}</span>}
        </div>
      </div>
      <div style={{height:8,borderRadius:4,background:"#1a2535",overflow:"visible",position:"relative"}}>
        <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${capped}%`,background:barColor,borderRadius:4,transition:"width 0.45s ease,background 0.3s ease"}}/>
        <div style={{position:"absolute",top:-3,left:"calc(100% - 1px)",width:2,height:14,background:C.border,borderRadius:1}}/>
      </div>
      <div style={{marginTop:4,fontSize:10,color:over?C.red:C.muted,textAlign:"right"}}>{over?`${Math.round(value-goal)}g over`:`${Math.round(goal-value)}g remaining`}</div>
    </div>
  );
}

function SplitBar({carbPct,onChange}){
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:6}}><span style={{color:C.purple,fontWeight:700}}>Carbs {carbPct}%</span><span style={{color:C.orange,fontWeight:700}}>Fat {100-carbPct}%</span></div>
      <input type="range" min="10" max="90" value={carbPct} onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:C.purple,cursor:"pointer",height:6}}/>
      <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",marginTop:8}}><div style={{width:`${carbPct}%`,background:C.purple,transition:"width 0.2s"}}/><div style={{flex:1,background:C.orange}}/></div>
    </div>
  );
}

const CustomTooltip=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:11}}><div style={{color:C.muted,marginBottom:4}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color}}>{p.name}: {Math.round(p.value)}</div>)}</div>);
};



// ── Foods library tab ────────────────────────────────────────────────────────
function FoodsTab({customFoods, onDelete, onLog}){
  const[search,setSearch]=useState("");
  const foods=Object.values(customFoods);
  const filtered=search.trim()?foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())):foods;
  return(
    <div style={{flex:1,overflowY:"auto",padding:16}}>
      <div style={{fontSize:11,color:C.muted,marginBottom:12,lineHeight:1.6}}>
        Your saved foods. Log any time: <span style={{color:C.accent}}>"log 2 servings of [name]"</span> in chat. Add by typing macros inline or scanning a label.
      </div>
      <div style={{position:"relative",marginBottom:16}}>
        <input style={{...inp,paddingLeft:36}} placeholder="Search foods..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:14}}>🔍</span>
      </div>
      {filtered.length===0&&(
        <div style={{fontSize:13,color:C.muted,textAlign:"center",marginTop:40,lineHeight:1.8}}>
          {foods.length===0?"No custom foods yet.\n\nScan a label or type macros inline:\n\"log protein bar, 200cal, 25g protein, 15g carbs, 5g fat\"":(`No foods match "${search}"`) }
        </div>
      )}
      {filtered.map(food=>(
        <div key={food.name} style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:600,color:C.text,textTransform:"capitalize",flex:1}}>{food.name}</div>
            <div style={{display:"flex",gap:6}}>
              <button style={{background:C.accent,border:"none",borderRadius:6,padding:"4px 10px",color:C.bg,fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}} onClick={()=>onLog(food)}>Log</button>
              <button style={{background:"none",border:`1px solid ${C.red}`,borderRadius:6,padding:"4px 8px",color:C.red,fontSize:11,fontFamily:"inherit",cursor:"pointer"}} onClick={()=>onDelete(food.name)}>✕</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {[["cal",food.calories,C.amber],["pro",food.protein_g+"g",C.accent],["carb",food.carbs_g+"g",C.purple],["fat",food.fat_g+"g",C.orange]].map(([l,v,c])=>(
              <div key={l} style={{flex:1,background:"#0a0f1a",borderRadius:6,padding:"5px 4px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.muted}}>{l}</div>
                <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:10,color:C.muted,marginTop:6}}>per serving · {food.servingSize||"1 serving"}</div>
        </div>
      ))}
    </div>
  );
}

// ── Lifts tab ────────────────────────────────────────────────────────────────
function LiftsTab({workouts,exerciseMap,onDeleteWorkout,onDeleteSet}){
  const[search,setSearch]=useState("");
  const[selected,setSelected]=useState(null);
  function resolveEx(raw){const l=raw.toLowerCase().trim();return exerciseMap[l]||HARD_ALIASES[l]||l;}
  const library={};
  workouts.forEach(w=>{w.sets.forEach(s=>{const c=resolveEx(s.exercise);if(!library[c])library[c]={sessions:[],aliases:new Set()};library[c].aliases.add(s.exercise.toLowerCase().trim());const ex=library[c].sessions.find(x=>x.date===w.date);if(ex){if(s.weight>ex.weight){ex.weight=s.weight;ex.reps=s.reps;ex.sets=s.sets;}}else library[c].sessions.push({date:w.date,weight:s.weight,reps:s.reps,sets:s.sets});});});
  Object.values(library).forEach(ex=>ex.sessions.sort((a,b)=>a.date.localeCompare(b.date)));
  const names=Object.keys(library).sort();
  const filtered=search.trim()?names.filter(n=>{const q=search.toLowerCase();return n.includes(q)||[...library[n].aliases].some(a=>a.includes(q));}):names;
  const sel=selected?library[selected]:null;
  const chartData=sel?sel.sessions.map(s=>({date:shortDate(s.date),weight:s.weight,reps:s.reps,sets:s.sets})):[];
  const best=sel?Math.max(...sel.sessions.map(s=>s.weight)):0;
  const latest=sel?sel.sessions[sel.sessions.length-1]:null;
  const trend=sel&&sel.sessions.length>=2?latest.weight-sel.sessions[0].weight:null;
  return(
    <div style={{flex:1,overflowY:"auto",padding:16}}>
      <div style={{position:"relative",marginBottom:16}}>
        <input style={{...inp,paddingLeft:36}} placeholder="Search exercises..." value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}}/>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:14}}>🔍</span>
      </div>
      {selected&&sel&&(
        <div style={{...card,borderColor:C.accent}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.text,textTransform:"capitalize",marginBottom:4}}>{selected}</div>
              {sel.aliases.size>1&&<div style={{fontSize:10,color:C.muted}}>also: {[...sel.aliases].filter(a=>a!==selected).join(", ")}</div>}
            </div>
            <button style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer",padding:0}} onClick={()=>setSelected(null)}>×</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {[["BEST",`${best} lbs`,C.amber],["LATEST",`${latest?.weight} lbs`,C.accent],["SESSIONS",sel.sessions.length,C.green],trend!==null?[trend>=0?"PROGRESS":"CHANGE",`${trend>=0?"+":""}${trend} lbs`,trend>=0?C.green:C.red]:null].filter(Boolean).map(([l,v,c])=>(
              <div key={l} style={{flex:1,background:"#0a0f1a",borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.muted,marginBottom:3}}>{l}</div>
                <div style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          {chartData.length>=1&&(
            <>
              <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:"0.08em",marginBottom:8}}>HEAVIEST SET PER SESSION</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{top:24,right:4,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:10}} domain={["auto","auto"]} axisLine={false} tickLine={false}/>
                  <Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const d=payload[0].payload;return<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:11}}><div style={{color:C.muted,marginBottom:4}}>{label}</div><div style={{color:C.amber}}>{d.weight} lbs</div><div style={{color:C.text}}>{d.sets}×{d.reps}</div></div>;}}/>
                  <Bar dataKey="weight" radius={[4,4,0,0]} label={(props)=>{const{x,y,width,value,index}=props;const reps=chartData[index]?.reps;if(!value||!reps)return null;return<text x={x+width/2} y={y-6} fill={C.muted} textAnchor="middle" fontSize={10} fontFamily="IBM Plex Mono,monospace">{reps}r</text>;}}>{chartData.map((e,i)=><Cell key={i} fill={e.weight===best?C.amber:C.accent} opacity={0.85}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:4}}>Bar = weight · number above = reps · <span style={{color:C.amber}}>gold = PR</span></div>
            </>
          )}
          <div style={{marginTop:16}}>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:"0.08em",marginBottom:8}}>SESSION LOG</div>
            {[...sel.sessions].reverse().map((s,i)=>(
              <div key={i} style={{...rowSt,fontSize:12}}>
                <span style={{color:C.muted}}>{shortDate(s.date)}</span>
                <span style={{flex:1,marginLeft:8}}>{s.sets}×{s.reps} @ <span style={{color:s.weight===best?C.amber:C.accent,fontWeight:700}}>{s.weight} lbs</span>{s.weight===best&&<span style={{fontSize:9,color:C.amber,marginLeft:4}}>★ PR</span>}</span>
                <DeleteBtn onDelete={()=>{onDeleteSet(s.date,selected);if(sel.sessions.length<=1)setSelected(null);}} style={{marginLeft:8}}/>
              </div>
            ))}
          </div>
        </div>
      )}
      {!selected&&(
        <>
          <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{filtered.length} exercise{filtered.length!==1?"s":""} · tap to view progress</div>
          {filtered.length===0&&<div style={{fontSize:13,color:C.muted,textAlign:"center",marginTop:40,whiteSpace:"pre-line"}}>{names.length===0?"No workouts logged yet.":(`No matches for "${search}"`)}</div>}
          {filtered.map(name=>{
            const ex=library[name];const pb=Math.max(...ex.sessions.map(s=>s.weight));const last=ex.sessions[ex.sessions.length-1];const up=ex.sessions.length>=2&&last.weight>ex.sessions[0].weight;const down=ex.sessions.length>=2&&last.weight<ex.sessions[0].weight;
            return(
              <div key={name} style={{...card,marginBottom:8,cursor:"pointer"}} onClick={()=>setSelected(name)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><div style={{fontSize:14,fontWeight:600,color:C.text,textTransform:"capitalize",marginBottom:3}}>{name}</div><div style={{fontSize:11,color:C.muted}}>{ex.sessions.length} session{ex.sessions.length!==1?"s":""} · last: {shortDate(last.date)}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:700,color:C.amber}}>{pb} lbs</div><div style={{fontSize:10,color:up?C.green:down?C.red:C.muted,marginTop:2}}>{up?"▲ trending up":down?"▼ trending down":"—"}</div></div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}


// ── Claude API calls ──────────────────────────────────────────────────────────
function buildDataContext(workouts,nutrition,bodyweight,goals,exerciseMap){
  function res(raw){const l=raw.toLowerCase().trim();return exerciseMap[l]||HARD_ALIASES[l]||l;}
  const exS={};workouts.forEach(w=>{w.sets.forEach(s=>{const n=res(s.exercise);if(!exS[n])exS[n]=[];exS[n].push({date:w.date,weight:s.weight});});});
  const nutD={};nutrition.forEach(n=>{if(!nutD[n.date])nutD[n.date]={calories:0,protein_g:0};n.items.forEach(i=>{nutD[n.date].calories+=i.calories||0;nutD[n.date].protein_g+=i.protein_g||0;});});
  return`GOALS: ${goals.calories}cal | ${goals.protein_g}g protein\nEXERCISES:\n${Object.entries(exS).map(([n,s])=>{const sorted=s.sort((a,b)=>a.date.localeCompare(b.date));const best=Math.max(...s.map(x=>x.weight));const lat=sorted[sorted.length-1];return`- ${n}: ${s.length} sessions, best=${best}lbs, latest=${lat.weight}lbs on ${lat.date}`;}).join("\n")}\nNUTRITION:\n${Object.entries(nutD).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,14).map(([d,x])=>`- ${d}: ${Math.round(x.calories)}cal | ${Math.round(x.protein_g)}g pro`).join("\n")}\nBODYWEIGHT:\n${bodyweight.slice(-14).map(b=>`- ${b.date}: ${b.weight}lbs`).join("\n")||"No data"}`;
}

async function callClaudeText(userMessage,context,systemPrompt){
  const res=await fetch("/api/anthropic",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "anthropic-version":"2023-06-01"
    },
    body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:1000,system:systemPrompt,messages:[...context,{role:"user",content:userMessage}]})
  });
  const data=await res.json();
  return data.content?.map(b=>b.text||"").join("")||"";
}

async function callClaudeImage(base64,mediaType){
  const res=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5",max_tokens:500,system:`You are a nutrition label scanner. Extract data from the label and return ONLY valid JSON:\n{"name":"product name (be specific)","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"servingSize":"string"}\nAll numbers should be per single serving. No markdown, no preamble.`,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mediaType,data:base64}},{type:"text",text:"Extract the nutrition info from this label."}]}]})});
  const data=await res.json();
  const text=data.content?.map(b=>b.text||"").join("")||"{}";
  try{return JSON.parse(text.replace(/```json|```/g,"").trim());}
  catch{return null;}
}

const PARSE_SYSTEM=`You are FitLog. Parse input into JSON only. No plain text.

Workout: {"type":"workout","sets":[{"exercise":"string","sets":number,"reps":number,"weight":number,"unit":"lbs"}]}
Nutrition with KNOWN macros (user stated cal/protein/carbs/fat): {"type":"nutrition_known","name":"food name","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"quantity":"string","meal":"breakfast"|"lunch"|"dinner"|"snack","servings":number}
Nutrition lookup (user didn't state macros): {"type":"nutrition","items":[{"name":"string","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"quantity":"string"}],"meal":"breakfast"|"lunch"|"dinner"|"snack"}
Bodyweight: {"type":"bodyweight","weight":number,"unit":"lbs"}
Save template: {"type":"save_template","name":"string","meal":"breakfast"|"lunch"|"dinner"|"snack","items":[{"name":"string","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"quantity":"string"}]}
Use template: {"type":"use_template","name":"string","servings":number}
Use custom food: {"type":"use_custom_food","name":"string","servings":number,"meal":"breakfast"|"lunch"|"dinner"|"snack"}
Trend/analysis question: {"type":"query"}
Unclear: {"type":"unclear","response":"string"}

IMPORTANT: If user provides explicit calorie/macro numbers, use "nutrition_known" type. IMPORTANT: If user provides explicit calorie/macro numbers, use "nutrition_known" type. For branded or packaged foods, always look up accurate macros rather than estimating. For generic whole foods (chicken breast, rice, banana etc) estimating is fine.`;

// ── Main App ──────────────────────────────────────────────────────────────────
export default function FitLog(){
  const[tab,setTab]=useState("chat");
  const[input,setInput]=useState("");
  const[messages,setMessages]=useState([
    {role:"assistant",content:"Hey! Log workouts, food, or bodyweight — or ask me anything.\n\n• \"Bench 3x8 at 185\"\n• \"Lunch: chicken breast, rice\"\n• \"Protein bar, 190cal, 21g protein, 18g carbs, 6g fat\" ← inline macros\n• \"175 lbs\" to log bodyweight\n• 📷 Scan a nutrition label\n• \"Is my bench improving?\"",type:"intro"}
  ]);
  const[workouts,setWorkouts]=useState([]);
  const[nutrition,setNutrition]=useState([]);
  const[bodyweight,setBW]=useState([]);
  const[goals,setGoals]=useState(DEFAULT_GOALS);
  const[templates,setTemplates]=useState({});
  const[exerciseMap,setExerciseMap]=useState({});
  const[customFoods,setCustomFoods]=useState({});
  const[draftCals,setDraftCals]=useState(String(DEFAULT_GOALS.calories));
  const[draftPro,setDraftPro]=useState(String(DEFAULT_GOALS.protein_g));
  const[draftSplit,setDraftSplit]=useState(DEFAULT_GOALS.carbFatSplit);
  const[loading,setLoading]=useState(false);
  const[context,setContext]=useState([]);
  const[bwInput,setBwInput]=useState("");
  const[savedFlash,setSavedFlash]=useState(false);
  const[confirmModal,setConfirmModal]=useState(null);
  const[labelModal,setLabelModal]=useState(null);
  const[saveFoodPrompt,setSaveFoodPrompt]=useState(null);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  const fileRef=useRef(null);

  useEffect(()=>{
    setWorkouts(load(STORAGE_KEYS.workouts,[]));
    setNutrition(load(STORAGE_KEYS.nutrition,[]));
    setBW(load(STORAGE_KEYS.bodyweight,[]));
    setTemplates(load(STORAGE_KEYS.templates,{}));
    setExerciseMap(load(STORAGE_KEYS.exerciseMap,{}));
    setCustomFoods(load(STORAGE_KEYS.customFoods,{}));
    const g=load(STORAGE_KEYS.goals,DEFAULT_GOALS);
    setGoals(g);setDraftCals(String(g.calories));setDraftPro(String(g.protein_g));setDraftSplit(g.carbFatSplit??60);
  },[]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  function resolveEx(raw,map=exerciseMap){const l=raw.toLowerCase().trim();return map[l]||HARD_ALIASES[l]||l;}
  function getKnownExercises(map=exerciseMap){const s=new Set();workouts.forEach(w=>w.sets.forEach(x=>s.add(resolveEx(x.exercise,map))));return[...s];}

  // ── Delete handlers ──────────────────────────────────────────────────────────

  // Delete an entire nutrition entry by its timestamp
  function deleteNutritionEntry(timestamp) {
    const updated = nutrition.filter(n => n.timestamp !== timestamp);
    setNutrition(updated);
    save(STORAGE_KEYS.nutrition, updated);
  }

  // Delete a single food item from a nutrition entry; removes entry if it becomes empty
  function deleteNutritionItem(entryTimestamp, itemIndex) {
    const updated = nutrition.map(n => {
      if (n.timestamp !== entryTimestamp) return n;
      const newItems = n.items.filter((_, i) => i !== itemIndex);
      return { ...n, items: newItems };
    }).filter(n => n.items.length > 0);
    setNutrition(updated);
    save(STORAGE_KEYS.nutrition, updated);
  }

  // Delete an entire workout entry by its timestamp
  function deleteWorkoutEntry(timestamp) {
    const updated = workouts.filter(w => w.timestamp !== timestamp);
    setWorkouts(updated);
    save(STORAGE_KEYS.workouts, updated);
  }

  // Delete a specific set from a workout entry (by date + exercise name); cleans up empty workouts
  function deleteWorkoutSet(date, exerciseName) {
    const updated = workouts.map(w => {
      if (w.date !== date) return w;
      const newSets = w.sets.filter(s => {
        const resolved = resolveEx(s.exercise);
        return resolved !== exerciseName && s.exercise.toLowerCase().trim() !== exerciseName;
      });
      return { ...w, sets: newSets };
    }).filter(w => w.sets.length > 0);
    setWorkouts(updated);
    save(STORAGE_KEYS.workouts, updated);
  }

  function commitWorkout(sets){
    const entry={date:today(),timestamp:Date.now(),sets};
    const u=[...workouts,entry];setWorkouts(u);save(STORAGE_KEYS.workouts,u);
    const reply=`✅ Workout logged!\n${sets.map(s=>`  • ${s.exercise}: ${s.sets}×${s.reps} @ ${s.weight}${s.unit}`).join("\n")}`;
    setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"workout"}]);
  }

  function processExQueue(queue,resolved,map){
    if(queue.length===0){commitWorkout(resolved);setConfirmModal(null);return;}
    const[next,...rest]=queue;
    const known=getKnownExercises(map);
    const lower=next.exercise.toLowerCase().trim();
    if(map[lower]||HARD_ALIASES[lower]){
      processExQueue(rest,[...resolved,{...next,exercise:resolveEx(lower,map)}],map);
    } else {
      const sim=findSimilarExercise(lower,known);
      if(sim&&sim!==lower){setConfirmModal({incoming:lower,existing:sim,set:next,remainingQueue:rest,resolvedSets:resolved,currentMap:map});}
      else processExQueue(rest,[...resolved,{...next,exercise:lower}],map);
    }
  }

  function handleSameEx(){
    if(!confirmModal)return;
    const{incoming,existing,set,remainingQueue,resolvedSets,currentMap}=confirmModal;
    const nm={...currentMap,[incoming]:existing};setExerciseMap(nm);save(STORAGE_KEYS.exerciseMap,nm);
    processExQueue(remainingQueue,[...resolvedSets,{...set,exercise:existing}],nm);
  }
  function handleDiffEx(){
    if(!confirmModal)return;
    const{incoming,set,remainingQueue,resolvedSets,currentMap}=confirmModal;
    const nm={...currentMap,[incoming]:incoming};setExerciseMap(nm);save(STORAGE_KEYS.exerciseMap,nm);
    processExQueue(remainingQueue,[...resolvedSets,{...set,exercise:incoming}],nm);
  }

  function logFoodItem(item, meal, promptSave=false){
    const entry={date:today(),timestamp:Date.now(),meal,items:[item]};
    const u=[...nutrition,entry];setNutrition(u);save(STORAGE_KEYS.nutrition,u);
    const reply=`✅ ${meal.charAt(0).toUpperCase()+meal.slice(1)} logged!\n  • ${item.quantity} ${item.name}: ${item.calories}cal\n${item.protein_g}g pro · ${item.carbs_g}g carbs · ${item.fat_g}g fat`;
    setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"nutrition"}]);
    if(promptSave&&!customFoods[item.name.toLowerCase()]){
      setSaveFoodPrompt({food:item,meal});
    }
  }

  function saveCustomFood(food){
    const key=food.name.toLowerCase();
    const updated={...customFoods,[key]:{...food,servingSize:food.quantity||"1 serving"}};
    setCustomFoods(updated);save(STORAGE_KEYS.customFoods,updated);
    setMessages(prev=>[...prev,{role:"assistant",content:`📌 "${food.name}" saved to your Foods library.`,type:"info"}]);
    setSaveFoodPrompt(null);
  }

  async function handleImageUpload(e){
    const file=e.target.files?.[0];
    if(!file)return;
    e.target.value="";
    setLoading(true);
    setMessages(prev=>[...prev,{role:"user",content:"📷 [nutrition label photo]"},{role:"assistant",content:"Scanning label...",type:"info"}]);
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      const scanned=await callClaudeImage(base64,file.type||"image/jpeg");
      if(scanned&&scanned.calories){
        setMessages(prev=>[...prev.slice(0,-1)]);
        setLabelModal(scanned);
      } else {
        setMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:"I couldn't read that label clearly. Try a closer, well-lit photo.",type:"unclear"}]);
      }
    }catch{setMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:"Something went wrong scanning the label.",type:"error"}]);}
    setLoading(false);
  }

  function handleLabelConfirm(scaled){
    setLabelModal(null);
    logFoodItem({...scaled,quantity:`${scaled.quantity}`},"snack",true);
  }

  const doLogBW=val=>{const n=parseFloat(val);if(isNaN(n)||n<50||n>500)return null;const entry={date:today(),weight:n,unit:"lbs",timestamp:Date.now()};const updated=[...bodyweight.filter(b=>b.date!==today()),entry].sort((a,b)=>a.date.localeCompare(b.date));setBW(updated);save(STORAGE_KEYS.bodyweight,updated);return n;};
  const saveGoals=()=>{const c=Math.max(0,parseInt(draftCals)||0),p=Math.max(0,parseInt(draftPro)||0),d=calcMacros(c,p,draftSplit),g={calories:c,protein_g:p,carbs_g:d.carbs_g,fat_g:d.fat_g,carbFatSplit:draftSplit};setGoals(g);save(STORAGE_KEYS.goals,g);setSavedFlash(true);setTimeout(()=>setSavedFlash(false),1800);};

  const handleSend=async()=>{
    if(!input.trim()||loading)return;
    const userMsg=input.trim();setInput("");
    setMessages(prev=>[...prev,{role:"user",content:userMsg}]);
    setLoading(true);
    try{
      const text=await callClaudeText(userMsg,context,PARSE_SYSTEM);
      let parsed;
      try{parsed=JSON.parse(text.replace(/```json|```/g,"").trim());}
      catch{parsed={type:"unclear",response:"I didn't understand that. Try: 'bench 3x8 at 185' or 'chicken and rice for lunch'"};}

      const nc=[...context,{role:"user",content:userMsg}];
      let reply="";

      if(parsed.type==="query"){
        const ans=await callClaudeText(userMsg,context,`You are FitLog, a personal fitness coach. Answer using the user's real data — specific numbers and dates. Concise plain text only.\n\n${buildDataContext(workouts,nutrition,bodyweight,goals,exerciseMap)}`);
        reply=ans||"Not enough data yet.";
        setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"info"}]);

      } else if(parsed.type==="workout"){
        setMessages(prev=>[...prev,{role:"assistant",content:"Got it! Just one sec...",type:"info"}]);
        processExQueue(parsed.sets,[],exerciseMap);
        reply="Workout processed.";

      } else if(parsed.type==="nutrition_known"){
        const item={
          name:parsed.name,
          calories:Math.round(parsed.calories*(parsed.servings||1)),
          protein_g:Math.round(parsed.protein_g*(parsed.servings||1)),
          carbs_g:Math.round(parsed.carbs_g*(parsed.servings||1)),
          fat_g:Math.round(parsed.fat_g*(parsed.servings||1)),
          quantity:`${parsed.servings||1} serving${(parsed.servings||1)!==1?"s":""}`,
        };
        logFoodItem(item,parsed.meal||"snack",true);
        reply=`logged ${item.name}`;

      } else if(parsed.type==="nutrition"){
        const entry={date:today(),timestamp:Date.now(),meal:parsed.meal,items:parsed.items};
        const u=[...nutrition,entry];setNutrition(u);save(STORAGE_KEYS.nutrition,u);
        const t=parsed.items.reduce((a,i)=>({cal:a.cal+(i.calories||0),p:a.p+(i.protein_g||0),c:a.c+(i.carbs_g||0),f:a.f+(i.fat_g||0)}),{cal:0,p:0,c:0,f:0});
        reply=`✅ ${parsed.meal.charAt(0).toUpperCase()+parsed.meal.slice(1)} logged!\n${parsed.items.map(i=>`  • ${i.quantity} ${i.name}: ${i.calories}cal`).join("\n")}\n\nTotal: ${t.cal}cal | ${t.p}g pro | ${t.c}g carbs | ${t.f}g fat`;
        setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"nutrition"}]);

      } else if(parsed.type==="use_custom_food"){
        const key=(parsed.name||"").toLowerCase();
        const match=Object.keys(customFoods).find(k=>key.includes(k)||k.includes(key));
        if(match){
          const food=customFoods[match];const mult=parsed.servings||1;
          const item={name:food.name,calories:Math.round(food.calories*mult),protein_g:Math.round(food.protein_g*mult),carbs_g:Math.round(food.carbs_g*mult),fat_g:Math.round(food.fat_g*mult),quantity:`${mult} serving${mult!==1?"s":""}`};
          logFoodItem(item,parsed.meal||"snack",false);
          reply=`logged ${item.name}`;
        } else {
          reply=`I don't have "${parsed.name}" in your Foods library yet. Log it with macros first and I'll offer to save it.`;
          setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"unclear"}]);
        }

      } else if(parsed.type==="bodyweight"){
        const val=doLogBW(String(parsed.weight));
        reply=val?`⚖️ Bodyweight logged: ${val} lbs`:"That weight didn't look right.";
        setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"bodyweight"}]);

      } else if(parsed.type==="save_template"){
        const tname=(parsed.name||"unnamed").toLowerCase();
        const updated={...templates,[tname]:{name:tname,meal:parsed.meal,items:parsed.items}};
        setTemplates(updated);save(STORAGE_KEYS.templates,updated);
        const t=parsed.items.reduce((a,i)=>({cal:a.cal+(i.calories||0),p:a.p+(i.protein_g||0)}),{cal:0,p:0});
        reply=`📌 Saved as "${tname}"\n${parsed.items.map(i=>`  • ${i.quantity} ${i.name}`).join("\n")}\n${t.cal}cal | ${Math.round(t.p)}g pro`;
        setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"info"}]);

      } else if(parsed.type==="use_template"){
        const tname=(parsed.name||"").toLowerCase();
        const match=Object.keys(templates).find(k=>tname.includes(k)||k.includes(tname));
        if(match){
          const tmpl=templates[match];const mult=parsed.servings||1;
          const items=tmpl.items.map(i=>({...i,calories:Math.round(i.calories*mult),protein_g:Math.round(i.protein_g*mult),carbs_g:Math.round(i.carbs_g*mult),fat_g:Math.round(i.fat_g*mult)}));
          const entry={date:today(),timestamp:Date.now(),meal:tmpl.meal,items};
          const u=[...nutrition,entry];setNutrition(u);save(STORAGE_KEYS.nutrition,u);
          const t=items.reduce((a,i)=>({cal:a.cal+(i.calories||0),p:a.p+(i.protein_g||0),c:a.c+(i.carbs_g||0),f:a.f+(i.fat_g||0)}),{cal:0,p:0,c:0,f:0});
          reply=`✅ "${match}" logged!\n${items.map(i=>`  • ${i.quantity} ${i.name}: ${i.calories}cal`).join("\n")}\n\n${t.cal}cal | ${t.p}g pro`;
          setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"nutrition"}]);
        } else {
        const ans=await callClaudeText(userMsg,context,`You are FitLog, a friendly fitness assistant. You help users log workouts, food, and bodyweight. You can also answer general fitness, nutrition, and health questions conversationally. Keep responses concise and helpful.\n\n${buildDataContext(workouts,nutrition,bodyweight,goals,exerciseMap)}`);
        reply=ans||"I didn't quite get that.";
        setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"info"}]);
      }

      } else {
        reply=parsed.response||"I didn't quite get that.";
        setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"unclear"}]);
      }

      nc.push({role:"assistant",content:reply});setContext(nc.slice(-10));
    }catch(e){setMessages(prev=>[...prev,{role:"assistant",content:"Something went wrong, try again.",type:"error"}]);}
    setLoading(false);inputRef.current?.focus();
  };

  const days=last7Days();
  const wkCal=days.map(d=>({date:shortDate(d),cal:Math.round(nutrition.filter(n=>n.date===d).reduce((a,e)=>a+e.items.reduce((b,i)=>b+(i.calories||0),0),0))}));
  const wkPro=days.map(d=>({date:shortDate(d),protein:Math.round(nutrition.filter(n=>n.date===d).reduce((a,e)=>a+e.items.reduce((b,i)=>b+(i.protein_g||0),0),0))}));
  const wkVol=days.map(d=>({date:shortDate(d),volume:Math.round(workouts.filter(w=>w.date===d).reduce((a,w)=>a+w.sets.reduce((b,s)=>b+(s.sets*s.reps*s.weight),0),0))}));
  const bwChart=days.map(d=>{const e=bodyweight.find(b=>b.date===d);return e?{date:shortDate(d),weight:e.weight}:null;}).filter(Boolean);
  const latestBW=bodyweight.length?bodyweight[bodyweight.length-1]:null;
  const previewC=Math.max(0,parseInt(draftCals)||0),previewP=Math.max(0,parseInt(draftPro)||0);
  const previewD=calcMacros(previewC,previewP,draftSplit);
  const proteinCals=previewP*4,remainCals=Math.max(0,previewC-proteinCals),proteinPct=previewC>0?Math.round((proteinCals/previewC)*100):0;
  const todayNut=nutrition.filter(n=>n.date===today());
  const todayWork=workouts.filter(w=>w.date===today());
  const todayMacros=todayNut.reduce((acc,e)=>{e.items.forEach(i=>{acc.calories+=i.calories||0;acc.protein_g+=i.protein_g||0;acc.carbs_g+=i.carbs_g||0;acc.fat_g+=i.fat_g||0;});return acc;},{calories:0,protein_g:0,carbs_g:0,fat_g:0});

  const tabSt=a=>({flex:1,padding:"9px 0",background:"none",border:"none",borderBottom:a?`2px solid ${C.accent}`:"2px solid transparent",color:a?C.accent:C.muted,cursor:"pointer",fontSize:9,fontWeight:700,fontFamily:"inherit",letterSpacing:"0.04em",textTransform:"uppercase",transition:"all 0.15s"});
  const aiBubble=t=>({alignSelf:"flex-start",background:t==="workout"?"#0a1f12":t==="nutrition"?"#161208":t==="bodyweight"?"#0d1320":C.surface,border:`1px solid ${t==="workout"?"#14532d":t==="nutrition"?"#3b2f00":C.border}`,borderRadius:"14px 14px 14px 4px",padding:"9px 13px",maxWidth:"86%",fontSize:13,whiteSpace:"pre-wrap",lineHeight:1.65});

  return(
    <div style={{fontFamily:"'IBM Plex Mono',monospace",background:C.bg,color:C.text,minHeight:"100vh",display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto"}}>
      {confirmModal&&<ExerciseConfirmModal incoming={confirmModal.incoming} existing={confirmModal.existing} onSame={handleSameEx} onDifferent={handleDiffEx}/>}
      {labelModal&&<LabelConfirmModal scanned={labelModal} onConfirm={handleLabelConfirm} onCancel={()=>setLabelModal(null)}/>}

      <div style={{padding:"14px 16px 0",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <p style={{fontSize:18,fontWeight:700,color:"#f8fafc",margin:"0 0 12px"}}>⚡ FitLog</p>
        <div style={{display:"flex"}}>
          {[["chat","Chat"],["dashboard","Today"],["lifts","Lifts"],["foods","Foods"],["charts","Charts"],["settings","⚙"]].map(([id,label])=>(
            <button key={id} style={tabSt(tab===id)} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
      </div>

      {tab==="chat"&&(<>
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px 0",display:"flex",flexDirection:"column",gap:10}}>
          {messages.map((m,i)=>m.role==="user"
            ?<div key={i} style={{alignSelf:"flex-end",background:C.accent,color:C.bg,borderRadius:"14px 14px 4px 14px",padding:"9px 13px",maxWidth:"80%",fontSize:13,fontWeight:500,whiteSpace:"pre-wrap"}}>{m.content}</div>
            :<div key={i} style={aiBubble(m.type)}>{m.content}</div>
          )}
          {loading&&<div style={aiBubble("info")}>⏳ thinking...</div>}
          {saveFoodPrompt&&(
            <SaveFoodPrompt
              food={saveFoodPrompt.food}
              onSave={()=>saveCustomFood(saveFoodPrompt.food)}
              onSkip={()=>setSaveFoodPrompt(null)}
            />
          )}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:"10px 14px 18px",display:"flex",gap:8,background:C.bg,borderTop:`1px solid ${C.border}`,flexShrink:0,alignItems:"center"}}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleImageUpload}/>
          <button
            style={{background:"#111827",border:`1px solid ${C.border}`,borderRadius:10,width:42,height:42,cursor:"pointer",fontSize:18,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}
            onClick={()=>fileRef.current?.click()}
            title="Scan nutrition label"
          >📷</button>
          <input ref={inputRef} style={{flex:1,background:"#0f1623",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 13px",color:C.text,fontSize:13,fontFamily:"inherit",outline:"none"}} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="Log, ask, or scan a label..."/>
          <button style={{background:C.accent,border:"none",borderRadius:10,width:42,height:42,cursor:"pointer",color:C.bg,fontWeight:700,fontSize:17,flexShrink:0}} onClick={handleSend}>→</button>
        </div>
      </>)}

      {tab==="dashboard"&&(
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          <div style={{...card,textAlign:"center"}}><div style={ctitle}>Calories</div><CalorieRing consumed={Math.round(todayMacros.calories)} goal={goals.calories}/></div>
          <div style={card}><div style={ctitle}>Macros</div><MacroBar label="Protein" value={todayMacros.protein_g} goal={goals.protein_g}/><MacroBar label="Carbs" value={todayMacros.carbs_g} goal={goals.carbs_g}/><MacroBar label="Fat" value={todayMacros.fat_g} goal={goals.fat_g}/></div>
          <div style={card}>
            <div style={ctitle}>⚖️ Bodyweight{latestBW?` — ${latestBW.weight} lbs (${latestBW.date===today()?"today":latestBW.date})`:""}</div>
            <div style={{display:"flex",gap:8}}>
              <input style={{...inp,flex:1}} type="number" placeholder="Enter weight (lbs)" value={bwInput} onChange={e=>setBwInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){doLogBW(bwInput);setBwInput("");}}}/>
              <button style={{background:C.accent,border:"none",borderRadius:10,padding:"9px 14px",color:C.bg,fontWeight:700,fontFamily:"inherit",fontSize:13,cursor:"pointer"}} onClick={()=>{doLogBW(bwInput);setBwInput("");}}>Log</button>
            </div>
          </div>

          {/* Today's Workout with delete */}
          <div style={card}>
            <div style={ctitle}>Today's Workout</div>
            {todayWork.length===0
              ? <div style={{fontSize:13,color:C.muted}}>No workout logged yet.</div>
              : todayWork.map((workout, wi) => (
                  <div key={workout.timestamp||wi}>
                    {workout.sets.map((s, si) => (
                      <div key={si} style={{...rowSt,gap:8}}>
                        <span
                          style={{textTransform:"capitalize",color:C.accent,textDecoration:"underline",textDecorationStyle:"dotted",cursor:"pointer",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                          onClick={()=>setTab("lifts")}
                        >{s.exercise}</span>
                        <span style={{color:C.text,fontWeight:600,flexShrink:0}}>{s.sets}×{s.reps} @ {s.weight}{s.unit}</span>
                        <DeleteBtn
                          onDelete={()=>deleteWorkoutEntry(workout.timestamp)}
                          style={{marginLeft:4}}
                        />
                      </div>
                    ))}
                  </div>
                ))
            }
          </div>

          {/* Today's Meals with per-item delete */}
          <div style={card}>
            <div style={ctitle}>Today's Meals</div>
            {todayNut.length===0
              ? <div style={{fontSize:13,color:C.muted}}>No food logged yet.</div>
              : todayNut.map((entry, ei) => (
                  <div key={entry.timestamp||ei} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <div style={{fontSize:10,color:C.muted,textTransform:"capitalize"}}>{entry.meal}</div>
                      {entry.items.length > 1 && (
                        <DeleteBtn
                          onDelete={()=>deleteNutritionEntry(entry.timestamp)}
                          style={{fontSize:9,padding:"2px 6px"}}
                        />
                      )}
                    </div>
                    {entry.items.map((item, ii) => (
                      <div key={ii} style={{...rowSt,fontSize:12,gap:8}}>
                        <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.quantity} {item.name}</span>
                        <span style={{color:C.amber,fontWeight:600,flexShrink:0}}>{item.calories}cal</span>
                        <DeleteBtn
                          onDelete={()=>deleteNutritionItem(entry.timestamp, ii)}
                        />
                      </div>
                    ))}
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {tab==="lifts"&&(
        <LiftsTab
          workouts={workouts}
          exerciseMap={exerciseMap}
          onDeleteWorkout={deleteWorkoutEntry}
          onDeleteSet={deleteWorkoutSet}
        />
      )}

      {tab==="foods"&&(
        <FoodsTab
          customFoods={customFoods}
          onDelete={name=>{const u={...customFoods};delete u[name.toLowerCase()];setCustomFoods(u);save(STORAGE_KEYS.customFoods,u);}}
          onLog={food=>{
            const entry={date:today(),timestamp:Date.now(),meal:"snack",items:[{...food,quantity:"1 serving"}]};
            const u=[...nutrition,entry];setNutrition(u);save(STORAGE_KEYS.nutrition,u);
            setTab("chat");
            setMessages(prev=>[...prev,{role:"assistant",content:`✅ ${food.name} logged!\n${food.calories}cal | ${food.protein_g}g pro | ${food.carbs_g}g carbs | ${food.fat_g}g fat`,type:"nutrition"}]);
          }}
        />
      )}

      {tab==="charts"&&(
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          {[{title:"Calories — Last 7 Days",data:wkCal,dKey:"cal",name:"Calories",color:C.amber},{title:"Protein — Last 7 Days",data:wkPro,dKey:"protein",name:"Protein (g)",color:C.accent},{title:"Workout Volume — Last 7 Days",data:wkVol,dKey:"volume",name:"Volume (lbs)",color:C.green}].map(({title,data,dKey,name,color})=>(
            <div key={title} style={card}><div style={ctitle}>{title}</div>
              <ResponsiveContainer width="100%" height={150}><BarChart data={data} margin={{top:4,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="date" tick={{fill:C.muted,fontSize:10}}/><YAxis tick={{fill:C.muted,fontSize:10}}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey={dKey} name={name} fill={color} radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
            </div>
          ))}
          <div style={card}><div style={ctitle}>Bodyweight Trend</div>
            {bwChart.length<2?<div style={{fontSize:13,color:C.muted}}>Log bodyweight on 2+ days to see trend.</div>
              :<ResponsiveContainer width="100%" height={150}><LineChart data={bwChart} margin={{top:4,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="date" tick={{fill:C.muted,fontSize:10}}/><YAxis tick={{fill:C.muted,fontSize:10}} domain={["auto","auto"]}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="weight" name="Weight (lbs)" stroke={C.purple} strokeWidth={2} dot={{fill:C.purple,r:3}}/></LineChart></ResponsiveContainer>}
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          <div style={card}>
            <div style={ctitle}>Macro Calculator</div>
            <div style={{marginBottom:14}}><label style={{fontSize:12,color:C.amber,fontWeight:600,display:"block",marginBottom:5}}>Daily Calories</label><input style={inp} type="number" value={draftCals} onChange={e=>setDraftCals(e.target.value)}/></div>
            <div style={{marginBottom:18}}><label style={{fontSize:12,color:C.accent,fontWeight:600,display:"block",marginBottom:5}}>Daily Protein (g)</label><input style={inp} type="number" value={draftPro} onChange={e=>setDraftPro(e.target.value)}/>{previewC>0&&<div style={{fontSize:11,color:C.muted,marginTop:5}}>Protein = <span style={{color:C.accent}}>{proteinPct}%</span> of cals · {remainCals}cal left for carbs & fat</div>}</div>
            <div style={{marginBottom:18}}><label style={{fontSize:12,color:C.text,fontWeight:600,display:"block",marginBottom:10}}>Remaining Calories Split</label><SplitBar carbPct={draftSplit} onChange={setDraftSplit}/></div>
            <div style={{background:"#0a0f1a",border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:14}}>
              {[["Calories",previewC,"cal",C.amber],["Protein",previewP,"g",C.accent],["Carbs",previewD.carbs_g,"g",C.purple],["Fat",previewD.fat_g,"g",C.orange]].map(([l,v,u,c])=>(<div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"4px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.muted}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}{u}</span></div>))}
            </div>
            <button style={{background:savedFlash?C.green:C.accent,border:"none",borderRadius:10,padding:"11px 16px",color:C.bg,fontWeight:700,fontFamily:"inherit",fontSize:13,cursor:"pointer",width:"100%",transition:"background 0.3s"}} onClick={saveGoals}>{savedFlash?"✓ Saved!":"Save Goals"}</button>
          </div>
          <div style={card}>
            <div style={ctitle}>Data</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>{workouts.length} sessions · {nutrition.length} meals · {bodyweight.length} weigh-ins · {Object.keys(customFoods).length} custom foods</div>
            <button style={{background:C.red,border:"none",borderRadius:10,padding:"10px 16px",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:12,cursor:"pointer",width:"100%"}} onClick={()=>{if(confirm("Delete ALL data? This cannot be undone.")){setWorkouts([]);setNutrition([]);setBW([]);setTemplates({});setExerciseMap({});setCustomFoods({});Object.values(STORAGE_KEYS).forEach(k=>localStorage.removeItem(k));}}}>Clear All Data</button>
          </div>
        </div>
      )}
    </div>
  );
}
