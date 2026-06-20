import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LineChart, Line } from "recharts";

const STORAGE_KEYS = {
  workouts: "fitlog_workouts",
  weeklysets: "fitlog_weeklysets",
  nutrition: "fitlog_nutrition",
  bodyweight: "fitlog_bodyweight",
  goals: "fitlog_goals",
  templates: "fitlog_templates",
  exerciseMap: "fitlog_exercise_map",
  customFoods: "fitlog_custom_foods",
  muscleOverrides: "fitlog_muscle_overrides",
};

const DEFAULT_GOALS = { calories: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, carbFatSplit: 60 };

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const last7Days = () => { const d=[]; for(let i=6;i>=0;i--){const x=new Date();x.setDate(x.getDate()-i);d.push(x.toISOString().split("T")[0]);}return d; };
const shortDate = iso => { const dt=new Date(iso+"T12:00:00"); return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][dt.getMonth()]} ${dt.getDate()}`; };
function calcMacros(calories,protein_g,carbPct){const rem=Math.max(0,calories-protein_g*4);return{carbs_g:Math.round(rem*(carbPct/100)/4),fat_g:Math.round(rem*((100-carbPct)/100)/9)};}
function load(key,fb){try{return JSON.parse(localStorage.getItem(key))??fb;}catch{return fb;}}
function save(key,data){localStorage.setItem(key,JSON.stringify(data));scheduleBinSync();}

const JSONBIN_ID=import.meta.env.VITE_JSONBIN_ID;
const JSONBIN_KEY=import.meta.env.VITE_JSONBIN_KEY;
let _syncTimer=null;
function scheduleBinSync(){
  if(!JSONBIN_ID||!JSONBIN_KEY)return;
  clearTimeout(_syncTimer);
  _syncTimer=setTimeout(()=>{
    const payload={};
    for(const[,v]of Object.entries(STORAGE_KEYS)){try{const d=localStorage.getItem(v);if(d)payload[v]=JSON.parse(d);}catch{}}
    fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}`,{method:"PUT",headers:{"Content-Type":"application/json","X-Master-Key":JSONBIN_KEY},body:JSON.stringify(payload)}).catch(()=>{});
  },2000);
}
async function loadFromBin(){
  if(!JSONBIN_ID||!JSONBIN_KEY)return null;
  try{
    const r=await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`,{headers:{"X-Master-Key":JSONBIN_KEY}});
    if(!r.ok)return null;
    const j=await r.json();
    return j.record||null;
  }catch{return null;}
}
const MUSCLE_MAP = {
  // chest
  "bench press":"chest","incline bench press":"chest","decline bench press":"chest","chest press":"chest","push up":"chest","pushup":"chest","push-up":"chest","dip":"chest","cable fly":"chest","pec deck":"chest","fly":"chest","chest":"chest","bench":"chest","pec":"chest","cable crossover":"chest","crossover":"chest","pullover":"chest","incline fly":"chest","decline fly":"chest","dumbbell fly":"chest",
  // shoulders
  "overhead press":"shoulders","shoulder press":"shoulders","lateral raise":"shoulders","front raise":"shoulders","face pull":"shoulders","upright row":"shoulders","arnold press":"shoulders","shoulder":"shoulders","lateral":"shoulders","rear delt":"shoulders","rear fly":"shoulders","reverse fly":"shoulders","delt":"shoulders","shrug":"shoulders",
  // back
  "pull-up":"back","chin-up":"back","barbell row":"back","lat pulldown":"back","seated row":"back","cable row":"back","t-bar row":"back","deadlift":"back","romanian deadlift":"back","rack pull":"back","back extension":"back","hyperextension":"back","back":"back","pulldown":"back","chin up":"back","t-bar":"back","pull down":"back","straight arm pulldown":"back","straight arm":"back","lat pull":"back",
  // legs
  "squat":"legs","leg press":"legs","lunge":"legs","leg extension":"legs","leg curl":"legs","hack squat":"legs","bulgarian split squat":"legs","calf raise":"legs","hip thrust":"legs","glute bridge":"legs","quad":"legs","quads":"legs","hamstring":"legs","hamstrings":"legs","glute":"legs","glutes":"legs","calf":"legs","calves":"legs","step up":"legs","split squat":"legs","front squat":"legs","sumo":"legs","sumo deadlift":"legs","goblet squat":"legs","rdl":"legs","nordic curl":"legs","lying leg curl":"legs","seated leg curl":"legs",
  // biceps
  "bicep curl":"biceps","hammer curl":"biceps","preacher curl":"biceps","concentration curl":"biceps","bicep":"biceps","biceps":"biceps","curl":"biceps","cable curl":"biceps","incline curl":"biceps","spider curl":"biceps",
  // triceps
  "tricep extension":"triceps","skullcrusher":"triceps","skull crusher":"triceps","tricep pushdown":"triceps","close grip bench":"triceps","overhead tricep extension":"triceps","rope pushdown":"triceps","cable pushdown":"triceps","tricep":"triceps","triceps":"triceps","pushdown":"triceps","kickback":"triceps","tricep kickback":"triceps","close grip":"triceps","overhead extension":"triceps","skull":"triceps",
  // core
  "plank":"core","crunch":"core","sit up":"core","ab rollout":"core","cable crunch":"core","leg raise":"core","ab wheel":"core","hanging knee raise":"core","russian twist":"core","abs":"core","ab":"core","hollow body":"core","dead bug":"core","mountain climber":"core","flutter kick":"core","hanging leg raise":"core","dragon flag":"core",
  // cardio
  "run":"cardio","running":"cardio","treadmill":"cardio","bike":"cardio","cycling":"cardio","elliptical":"cardio","rowing":"cardio","stairmaster":"cardio","jump rope":"cardio","hiit":"cardio","cardio":"cardio","walk":"cardio","walking":"cardio","power walk":"cardio","power walking":"cardio","swim":"cardio","swimming":"cardio","spin":"cardio","assault bike":"cardio","air bike":"cardio","rower":"cardio",
  // kettlebell
  "kettlebell":"kettlebell","kb":"kettlebell","kettlebell swing":"kettlebell","kb swing":"kettlebell","swing":"kettlebell","turkish get-up":"kettlebell","turkish getup":"kettlebell","tgu":"kettlebell","kettlebell snatch":"kettlebell","kb snatch":"kettlebell","kettlebell clean":"kettlebell","kb clean":"kettlebell","clean and press":"kettlebell","kettlebell press":"kettlebell","kb press":"kettlebell","kettlebell row":"kettlebell","kb row":"kettlebell","kettlebell deadlift":"kettlebell","kb deadlift":"kettlebell","windmill":"kettlebell","halo":"kettlebell","kettlebell halo":"kettlebell","figure 8":"kettlebell","kettlebell figure 8":"kettlebell","kb figure 8":"kettlebell","goblet":"kettlebell",
};

const VALID_MUSCLE_GROUPS=["chest","back","shoulders","legs","biceps","triceps","core","cardio","kettlebell"];
function getMuscleGroup(exercise,overrides={}){
  const lower=exercise.toLowerCase().trim();
  if(overrides[lower])return overrides[lower];
  if(MUSCLE_MAP[lower])return MUSCLE_MAP[lower];
  let best=null,bestLen=0;
  for(const[k,v]of Object.entries(MUSCLE_MAP)){if(lower.includes(k)&&k.length>bestLen){bestLen=k.length;best=v;}}
  return best||"other";
}
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
  "tricep extension":"tricep extension","skullcrusher":"skullcrusher","skull crusher":"skullcrusher","tricep rope":"tricep pushdown","overhead extension":"overhead tricep extension","tricep dip":"tricep extension","tricep dips":"tricep extension",
  "lunge":"lunge","lunges":"lunge","dip":"dip","dips":"dip","glute bridge":"glute bridge","hip hinge":"romanian deadlift",
};

function tokenize(s){return s.toLowerCase().replace(/[^a-z0-9 ]/g,"").split(/\s+/).filter(Boolean);}
function wordOverlapScore(a,b){const ta=new Set(tokenize(a)),tb=new Set(tokenize(b));const i=[...ta].filter(t=>tb.has(t)).length,u=new Set([...ta,...tb]).size;return u===0?0:i/u;}
function levenshtein(a,b){const m=a.length,n=b.length,dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);return dp[m][n];}
function similarityScore(a,b){const ov=wordOverlapScore(a,b),ml=Math.max(a.length,b.length),ed=ml===0?1:1-levenshtein(a.toLowerCase(),b.toLowerCase())/ml;return ov*0.7+ed*0.3;}
function findSimilarExercise(incoming,known,threshold=0.45){let best=null,bs=threshold;for(const k of known){const s=similarityScore(incoming.toLowerCase(),k.toLowerCase());if(s>bs){bs=s;best=k;}}return best;}

// ── Light theme ───────────────────────────────────────────────────────────────
const C={
  bg:"#f5f7fa",
  surface:"#ffffff",
  border:"#e8ecf0",
  borderStrong:"#d1d9e0",
  text:"#1a202c",
  muted:"#718096",
  mutedLight:"#a0aec0",
  accent:"#3b82f6",
  accentLight:"#eff6ff",
  green:"#10b981",
  greenLight:"#ecfdf5",
  amber:"#f59e0b",
  amberLight:"#fffbeb",
  purple:"#8b5cf6",
  purpleLight:"#f5f3ff",
  orange:"#f97316",
  orangeLight:"#fff7ed",
  red:"#ef4444",
  redLight:"#fef2f2",
};

const card={background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:18,marginBottom:14,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"};
const ctitle={fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:C.mutedLight,marginBottom:14};
const rowSt={display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:15,padding:"10px 0",borderBottom:`1px solid ${C.border}`};
const inp={background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.text,fontSize:16,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};

function progressColor(pct){if(pct>=105)return C.red;if(pct>=90)return C.amber;return C.green;}

// ── Delete button ─────────────────────────────────────────────────────────────
function DeleteBtn({ onDelete, style = {} }) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef(null);
  function handleClick(e) {
    e.stopPropagation();
    if (confirming) { clearTimeout(timerRef.current); setConfirming(false); onDelete(); }
    else { setConfirming(true); timerRef.current = setTimeout(() => setConfirming(false), 2500); }
  }
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return (
    <button onClick={handleClick} style={{background:confirming?C.red:"none",border:`1.5px solid ${confirming?C.red:C.border}`,borderRadius:8,padding:"4px 10px",color:confirming?"#fff":C.mutedLight,fontSize:12,fontFamily:"inherit",fontWeight:confirming?700:400,cursor:"pointer",flexShrink:0,transition:"all 0.15s",whiteSpace:"nowrap",minHeight:32,...style}}>
      {confirming?"confirm?":"✕"}
    </button>
  );
}

// ── Edit food item modal ──────────────────────────────────────────────────────
function EditFoodModal({item,onSave,onCancel}){
  const[name,setName]=useState(item.name||"");
  const[quantity,setQuantity]=useState(item.quantity||"");
  const[calories,setCalories]=useState(String(item.calories??""));
  const[protein,setProtein]=useState(String(item.protein_g??""));
  const[carbs,setCarbs]=useState(String(item.carbs_g??""));
  const[fat,setFat]=useState(String(item.fat_g??""));
  const lbl={fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:600};
  const field=(c)=>({...inp,padding:"10px 12px",fontSize:15,borderColor:c||C.border});
  function handleSave(){
    onSave({
      name:name.trim()||item.name,
      quantity:quantity.trim()||item.quantity,
      calories:Math.max(0,Math.round(parseFloat(calories)||0)),
      protein_g:Math.max(0,Math.round(parseFloat(protein)||0)),
      carbs_g:Math.max(0,Math.round(parseFloat(carbs)||0)),
      fat_g:Math.max(0,Math.round(parseFloat(fat)||0)),
    });
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:24,width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{fontSize:12,color:C.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Edit Item</div>
        <div style={{marginBottom:12}}><label style={lbl}>Name</label><input style={field()} value={name} onChange={e=>setName(e.target.value)}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>Quantity</label><input style={field()} value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="e.g. 1 cup"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
          <div><label style={{...lbl,color:C.amber}}>Calories</label><input style={field(C.amber)} type="number" inputMode="numeric" value={calories} onChange={e=>setCalories(e.target.value)}/></div>
          <div><label style={{...lbl,color:C.accent}}>Protein (g)</label><input style={field(C.accent)} type="number" inputMode="numeric" value={protein} onChange={e=>setProtein(e.target.value)}/></div>
          <div><label style={{...lbl,color:C.purple}}>Carbs (g)</label><input style={field(C.purple)} type="number" inputMode="numeric" value={carbs} onChange={e=>setCarbs(e.target.value)}/></div>
          <div><label style={{...lbl,color:C.orange}}>Fat (g)</label><input style={field(C.orange)} type="number" inputMode="numeric" value={fat} onChange={e=>setFat(e.target.value)}/></div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={{flex:1,background:C.accent,border:"none",borderRadius:12,padding:"14px 0",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={handleSave}>Save</button>
          <button style={{flex:1,background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"14px 0",color:C.muted,fontWeight:600,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit custom food modal ────────────────────────────────────────────────────
function EditCustomFoodModal({food,onSave,onCancel}){
  const[name,setName]=useState(food.name||"");
  const[servingSize,setServingSize]=useState(food.servingSize||"1 serving");
  const[calories,setCalories]=useState(String(food.calories??""));
  const[protein,setProtein]=useState(String(food.protein_g??""));
  const[carbs,setCarbs]=useState(String(food.carbs_g??""));
  const[fat,setFat]=useState(String(food.fat_g??""));
  const lbl={fontSize:12,color:C.muted,display:"block",marginBottom:6,fontWeight:600};
  const field=(c)=>({...inp,padding:"10px 12px",fontSize:15,borderColor:c||C.border});
  function handleSave(){
    onSave({
      name:name.trim()||food.name,
      servingSize:servingSize.trim()||food.servingSize||"1 serving",
      calories:Math.max(0,Math.round(parseFloat(calories)||0)),
      protein_g:Math.max(0,Math.round(parseFloat(protein)||0)),
      carbs_g:Math.max(0,Math.round(parseFloat(carbs)||0)),
      fat_g:Math.max(0,Math.round(parseFloat(fat)||0)),
    });
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:24,width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{fontSize:12,color:C.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Edit Saved Food</div>
        <div style={{marginBottom:12}}><label style={lbl}>Name</label><input style={field()} value={name} onChange={e=>setName(e.target.value)}/></div>
        <div style={{marginBottom:12}}><label style={lbl}>Serving size</label><input style={field()} value={servingSize} onChange={e=>setServingSize(e.target.value)} placeholder="e.g. 1 cup"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
          <div><label style={{...lbl,color:C.amber}}>Calories</label><input style={field(C.amber)} type="number" inputMode="numeric" value={calories} onChange={e=>setCalories(e.target.value)}/></div>
          <div><label style={{...lbl,color:C.accent}}>Protein (g)</label><input style={field(C.accent)} type="number" inputMode="numeric" value={protein} onChange={e=>setProtein(e.target.value)}/></div>
          <div><label style={{...lbl,color:C.purple}}>Carbs (g)</label><input style={field(C.purple)} type="number" inputMode="numeric" value={carbs} onChange={e=>setCarbs(e.target.value)}/></div>
          <div><label style={{...lbl,color:C.orange}}>Fat (g)</label><input style={field(C.orange)} type="number" inputMode="numeric" value={fat} onChange={e=>setFat(e.target.value)}/></div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={{flex:1,background:C.accent,border:"none",borderRadius:12,padding:"14px 0",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={handleSave}>Save</button>
          <button style={{flex:1,background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"14px 0",color:C.muted,fontWeight:600,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Label confirm modal ───────────────────────────────────────────────────────
function LabelConfirmModal({scanned,onConfirm,onCancel}){
  const[servings,setServings]=useState("1");   const[rawInput,setRawInput]=useState("1");
  const mult=parseFloat(servings)||1;
  const scaled={name:scanned.name,calories:Math.round(scanned.calories*mult),protein_g:Math.round(scanned.protein_g*mult),carbs_g:Math.round(scanned.carbs_g*mult),fat_g:Math.round(scanned.fat_g*mult),quantity:scanned.servingUnit?`${Math.round(mult*scanned.servingAmount)} ${scanned.servingUnit}`:`${servings} serving${mult!==1?"s":""}`,servingUnit:scanned.servingUnit||null,servingAmount:scanned.servingAmount||1};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:24,width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{fontSize:12,color:C.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Label Scanned ✓</div>
        <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:16,textTransform:"capitalize"}}>{scanned.name}</div>
        <div style={{background:C.bg,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,color:C.mutedLight,marginBottom:10,letterSpacing:"0.06em",fontWeight:600}}>PER SERVING</div>
          {[["Calories",scanned.calories,"cal",C.amber],["Protein",scanned.protein_g,"g",C.accent],["Carbs",scanned.carbs_g,"g",C.purple],["Fat",scanned.fat_g,"g",C.orange]].map(([l,v,u,c])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:15,padding:"4px 0"}}>
              <span style={{color:C.muted}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}{u}</span>
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:13,color:C.muted,display:"block",marginBottom:8,fontWeight:500}}>{scanned.servingUnit?`How many ${scanned.servingUnit}? (1 serving = ${scanned.servingAmount} ${scanned.servingUnit})`:"How many servings?"}</label>
          <input style={{...inp,textAlign:"center",fontSize:18,fontWeight:700}} type="number" step={scanned.servingUnit?scanned.servingAmount:0.5} min={scanned.servingUnit?scanned.servingAmount:0.5} value={rawInput} onChange={e=>{setRawInput(e.target.value);const n=parseFloat(e.target.value);if(!isNaN(n)&&n>0){scanned.servingUnit?setServings(String(n/scanned.servingAmount)):setServings(e.target.value);}}}/>
        </div>
        {mult!==1&&(
          <div style={{background:C.accentLight,borderRadius:12,padding:12,marginBottom:16}}>
            <div style={{fontSize:11,color:C.accent,marginBottom:8,fontWeight:600}}>TOTAL ({servings} servings)</div>
            {[["Calories",scaled.calories,"cal",C.amber],["Protein",scaled.protein_g,"g",C.accent],["Carbs",scaled.carbs_g,"g",C.purple],["Fat",scaled.fat_g,"g",C.orange]].map(([l,v,u,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:14,padding:"3px 0"}}>
                <span style={{color:C.muted}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}{u}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <button style={{flex:1,background:C.accent,border:"none",borderRadius:12,padding:"14px 0",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={()=>onConfirm(scaled)}>Log It</button>
          <button style={{flex:1,background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"14px 0",color:C.muted,fontWeight:600,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Exercise confirm modal ────────────────────────────────────────────────────
function ExerciseConfirmModal({incoming,existing,onSame,onDifferent}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,padding:24,width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{fontSize:12,color:C.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Same Exercise?</div>
        <div style={{fontSize:15,color:C.text,lineHeight:1.6,marginBottom:20}}>
          You logged <span style={{color:C.amber,fontWeight:700}}>"{incoming}"</span> — is this the same as <span style={{color:C.green,fontWeight:700}}>"{existing}"</span> already in your library?
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={{flex:1,background:C.green,border:"none",borderRadius:12,padding:"14px 0",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={onSame}>✓ Yes, same</button>
          <button style={{flex:1,background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"14px 0",color:C.text,fontWeight:600,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={onDifferent}>No, different</button>
        </div>
      </div>
    </div>
  );
}

// ── Save food prompt ──────────────────────────────────────────────────────────
function SaveFoodPrompt({food,onSave,onSkip}){
  return(
    <div style={{...card,border:`1.5px solid ${C.amber}`,background:C.amberLight,marginTop:-6}}>
      <div style={{fontSize:14,color:C.amber,fontWeight:700,marginBottom:6}}>Save "{food.name}" to library?</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:12}}>{food.calories} cal · {food.protein_g}g protein · {food.carbs_g}g carbs · {food.fat_g}g fat</div>
      <div style={{display:"flex",gap:8}}>
        <button style={{flex:1,background:C.amber,border:"none",borderRadius:10,padding:"10px 0",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:14,cursor:"pointer"}} onClick={onSave}>Save</button>
        <button style={{flex:1,background:"none",border:`1.5px solid ${C.borderStrong}`,borderRadius:10,padding:"10px 0",color:C.muted,fontFamily:"inherit",fontSize:14,cursor:"pointer"}} onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}

// ── Calorie ring ──────────────────────────────────────────────────────────────
function CalorieRing({consumed,goal}){
  const pct=goal>0?consumed/goal:0,over=pct>1,R=80,stroke=13,norm=2*Math.PI*R;
  const filled=Math.min(pct,1)*norm,overArc=over?Math.min((pct-1),1)*norm:0;
  const color=progressColor(pct*100),remaining=Math.max(0,goal-consumed);
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 0 8px"}}>
      <svg width={200} height={200} viewBox="0 0 200 200">
        <circle cx={100} cy={100} r={R} fill="none" stroke={C.border} strokeWidth={stroke}/>
        {filled>0&&<circle cx={100} cy={100} r={R} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${filled} ${norm}`} strokeDashoffset={norm*0.25*-1} strokeLinecap="round" style={{transition:"stroke-dasharray 0.5s ease,stroke 0.4s ease"}}/>}
        {over&&overArc>0&&<circle cx={100} cy={100} r={R} fill="none" stroke={C.red} strokeWidth={stroke} opacity={0.4} strokeDasharray={`${overArc} ${norm}`} strokeDashoffset={norm*0.25*-1} strokeLinecap="round"/>}
        <text x={100} y={90} textAnchor="middle" fill={color} fontSize={34} fontWeight={700} fontFamily="-apple-system,sans-serif">{consumed}</text>
        <text x={100} y={112} textAnchor="middle" fill={C.mutedLight} fontSize={13} fontFamily="-apple-system,sans-serif">of {goal} cal</text>
        <text x={100} y={130} textAnchor="middle" fill={over?C.red:C.muted} fontSize={13} fontFamily="-apple-system,sans-serif" fontWeight={500}>{over?`${consumed-goal} over goal`:`${remaining} remaining`}</text>
      </svg>
    </div>
  );
}

// ── Macro bar ─────────────────────────────────────────────────────────────────
function MacroBar({label,value,goal,color}){
  const pct=goal>0?(value/goal)*100:0,capped=Math.min(pct,100),over=pct>100;
  const barColor=over?C.red:color;
  return(
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:7}}>
        <span style={{fontSize:15,fontWeight:600,color:C.text}}>{label}</span>
        <div style={{display:"flex",alignItems:"baseline",gap:4}}>
          <span style={{fontSize:20,fontWeight:700,color:barColor}}>{Math.round(value)}</span>
          <span style={{fontSize:13,color:C.mutedLight}}>/ {goal}g</span>
          {over&&<span style={{fontSize:11,fontWeight:700,color:C.red,background:C.redLight,padding:"2px 7px",borderRadius:6}}>+{Math.round(value-goal)}</span>}
        </div>
      </div>
      <div style={{height:10,borderRadius:6,background:C.bg,border:`1px solid ${C.border}`,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${capped}%`,background:barColor,borderRadius:6,transition:"width 0.45s ease"}}/>
      </div>
      <div style={{marginTop:5,fontSize:12,color:over?C.red:C.mutedLight,textAlign:"right"}}>{over?`${Math.round(value-goal)}g over`:`${Math.round(goal-value)}g left`}</div>
    </div>
  );
}

// ── Split bar ─────────────────────────────────────────────────────────────────
function SplitBar({carbPct,onChange}){
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:8,fontWeight:600}}><span style={{color:C.purple}}>Carbs {carbPct}%</span><span style={{color:C.orange}}>Fat {100-carbPct}%</span></div>
      <input type="range" min="10" max="90" value={carbPct} onChange={e=>onChange(+e.target.value)} style={{width:"100%",accentColor:C.purple,cursor:"pointer",height:6}}/>
      <div style={{display:"flex",height:10,borderRadius:6,overflow:"hidden",marginTop:10}}><div style={{width:`${carbPct}%`,background:C.purple,transition:"width 0.2s"}}/><div style={{flex:1,background:C.orange}}/></div>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const CustomTooltip=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><div style={{color:C.muted,marginBottom:4,fontWeight:500}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color,fontWeight:600}}>{p.name}: {Math.round(p.value)}</div>)}</div>);
};

// ── Foods tab ─────────────────────────────────────────────────────────────────
function FoodsTab({customFoods,onDelete,onLog,onEdit}){
  const[search,setSearch]=useState("");
  const foods=Object.values(customFoods);
  const filtered=search.trim()?foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase())):foods;
  return(
   <div style={{flex:1,overflowY:"auto",padding:16}}>
      <div style={{position:"relative",marginBottom:16}}>
        <input style={{...inp,paddingLeft:42}} placeholder="Search foods..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.mutedLight,fontSize:16}}>🔍</span>
      </div>
      {filtered.length===0&&(
        <div style={{fontSize:14,color:C.muted,textAlign:"center",marginTop:48,lineHeight:2,whiteSpace:"pre-line"}}>
          {foods.length===0?"No saved foods yet.\n\nScan a label or type macros:\n\"protein bar, 200cal, 25g protein, 15g carbs, 5g fat\"":(`No foods match "${search}"`)}
        </div>
      )}
      {filtered.map(food=>(
        <div key={food.name} style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div style={{fontSize:16,fontWeight:600,color:C.text,textTransform:"capitalize",flex:1}}>{food.name}</div>
            <div style={{display:"flex",gap:8}}>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>               <input                 type="number"                 placeholder={food.servingUnit?`# ${food.servingUnit}`:"servings"}                 style={{...inp,width:90,padding:"6px 8px",fontSize:13,textAlign:"center"}}                 id={`log-amt-${food.name}`}               />               <button style={{background:C.accent,border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",fontSize:13,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}} onClick={()=>{const el=document.getElementById(`log-amt-${food.name}`);const val=parseFloat(el?.value)||1;const mult=food.servingUnit?val/getServingBase(food):val;onLog(food,mult);}}>Log</button>             </div>
              <button style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 10px",color:C.mutedLight,fontSize:13,fontFamily:"inherit",cursor:"pointer"}} onClick={()=>onEdit&&onEdit(food)}>✎</button>
              <button style={{background:C.redLight,border:`1px solid ${C.red}`,borderRadius:8,padding:"6px 10px",color:C.red,fontSize:13,fontFamily:"inherit",cursor:"pointer"}} onClick={()=>onDelete(food.name)}>✕</button>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {[["cal",food.calories,C.amber,C.amberLight],["pro",food.protein_g+"g",C.accent,C.accentLight],["carb",food.carbs_g+"g",C.purple,C.purpleLight],["fat",food.fat_g+"g",C.orange,C.orangeLight]].map(([l,v,c,bg])=>(
              <div key={l} style={{flex:1,background:bg,borderRadius:8,padding:"7px 4px",textAlign:"center"}}>
                <div style={{fontSize:10,color:c,fontWeight:600,marginBottom:2}}>{l}</div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:C.mutedLight,marginTop:8}}>per serving · {food.servingSize||"1 serving"}</div>
        </div>
      ))}
    </div>
  );
}

// ── Lifts tab ─────────────────────────────────────────────────────────────────
function LiftsTab({workouts,exerciseMap,muscleOverrides={},onDeleteWorkout,onDeleteSet,weeklySets}){
  const[search,setSearch]=useState("");
  const[selected,setSelected]=useState(null);
  const[expandedMuscle,setExpandedMuscle]=useState(null);
  const[liftsWeekOffset,setLiftsWeekOffset]=useState(0);
  function resolveEx(raw){const l=raw.toLowerCase().trim();return exerciseMap[l]||HARD_ALIASES[l]||l;}
  function weekMonday(offset){const d=new Date();const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day)-offset*7);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  const monday=weekMonday(liftsWeekOffset);
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(monday+"T12:00:00");d.setDate(d.getDate()+i);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;});
  function weekLabel(){const s=new Date(monday+"T12:00:00"),e=new Date(monday+"T12:00:00");e.setDate(e.getDate()+6);const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];return s.getMonth()===e.getMonth()?`${M[s.getMonth()]} ${s.getDate()}–${e.getDate()}`:`${M[s.getMonth()]} ${s.getDate()} – ${M[e.getMonth()]} ${e.getDate()}`;}
  const currentWeekSets={};workouts.filter(w=>weekDays.includes(w.date)).forEach(w=>{const cardioSets=w.sets.filter(s=>getMuscleGroup(resolveEx(s.exercise),muscleOverrides)==="cardio");const nonCardioSets=w.sets.filter(s=>getMuscleGroup(resolveEx(s.exercise),muscleOverrides)!=="cardio");if(cardioSets.length>0)currentWeekSets["cardio"]=(currentWeekSets["cardio"]||0)+1;nonCardioSets.forEach(s=>{const mg=getMuscleGroup(resolveEx(s.exercise),muscleOverrides);currentWeekSets[mg]=(currentWeekSets[mg]||0)+s.sets;});});const muscleOrder=["chest","back","shoulders","legs","biceps","triceps","core","cardio","kettlebell","other"];
  const weekEntries=muscleOrder.filter(m=>currentWeekSets[m]>0).map(m=>([m,currentWeekSets[m]]));const maxSets=weekEntries.length?Math.max(...weekEntries.map(([,v])=>v)):0;
  const muscleDetail={};workouts.filter(w=>weekDays.includes(w.date)).forEach(w=>w.sets.forEach(s=>{const mg=getMuscleGroup(resolveEx(s.exercise),muscleOverrides);const ex=resolveEx(s.exercise);if(!muscleDetail[mg])muscleDetail[mg]={};if(!muscleDetail[mg][ex])muscleDetail[mg][ex]={sets:0,dates:[]};muscleDetail[mg][ex].sets+=s.sets;if(!muscleDetail[mg][ex].dates.includes(w.date))muscleDetail[mg][ex].dates.push(w.date);}));
  const library={};
  workouts.forEach(w=>{w.sets.forEach(s=>{const c=resolveEx(s.exercise);if(!s.weight||s.weight===0)return;if(getMuscleGroup(c,muscleOverrides)==="cardio")return;if(!library[c])library[c]={sessions:[],aliases:new Set()};library[c].aliases.add(s.exercise.toLowerCase().trim());const ex=library[c].sessions.find(x=>x.date===w.date);if(ex){if(s.weight>ex.weight){ex.weight=s.weight;ex.reps=s.reps;ex.sets=s.sets;}}else library[c].sessions.push({date:w.date,weight:s.weight,reps:s.reps,sets:s.sets});});});
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
      <div style={{...card,marginBottom:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><span style={{...ctitle,marginBottom:0}}>Weekly Sets</span><div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={()=>setLiftsWeekOffset(o=>o+1)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>←</button><span style={{fontSize:12,color:C.muted,fontWeight:600,whiteSpace:"nowrap"}}>{liftsWeekOffset===0?"This Week":weekLabel()}</span><button onClick={()=>setLiftsWeekOffset(o=>Math.max(0,o-1))} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",opacity:liftsWeekOffset===0?0.3:1}} disabled={liftsWeekOffset===0}>→</button></div></div>{weekEntries.length===0?<div style={{fontSize:14,color:C.muted,textAlign:"center",padding:"12px 0"}}>No workouts this week.</div>:weekEntries.map(([muscle,sets])=>(<div key={muscle} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4,cursor:"pointer"}} onClick={()=>setExpandedMuscle(expandedMuscle===muscle?null:muscle)}><span style={{fontSize:14,fontWeight:600,color:C.text,textTransform:"capitalize"}}>{muscle} {expandedMuscle===muscle?"▲":"▼"}</span><span style={{fontSize:14,fontWeight:700,color:C.accent}}>{muscle==="cardio"?`${sets} session${sets!==1?"s":""}`:`${sets} sets`}</span></div><div style={{height:8,borderRadius:4,background:C.bg,border:`1px solid ${C.border}`,overflow:"hidden",marginBottom:expandedMuscle===muscle?8:0}}><div style={{height:"100%",width:`${(sets/maxSets)*100}%`,background:C.accent,borderRadius:4,transition:"width 0.4s ease"}}/></div>{expandedMuscle===muscle&&muscleDetail[muscle]&&Object.entries(muscleDetail[muscle]).map(([ex,data])=>(<div key={ex} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.text,textTransform:"capitalize"}}>{ex}</span><span style={{color:C.muted}}>{data.sets} sets · {data.dates.map(d=>shortDate(d)).join(", ")}</span></div>))}</div>))}</div>
      <div style={{position:"relative",marginBottom:16}}>
        <input style={{...inp,paddingLeft:42}} placeholder="Search exercises..." value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}}/>
        <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.mutedLight,fontSize:16}}>🔍</span>
      </div>
      {selected&&sel&&(
        <div style={{...card,border:`1.5px solid ${C.accent}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
            <div>
              <div style={{fontSize:18,fontWeight:700,color:C.text,textTransform:"capitalize",marginBottom:4}}>{selected}</div>
              {sel.aliases.size>1&&<div style={{fontSize:12,color:C.mutedLight}}>also: {[...sel.aliases].filter(a=>a!==selected).join(", ")}</div>}
            </div>
            <button style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,width:34,height:34,color:C.muted,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setSelected(null)}>×</button>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:18}}>
            {[["BEST",`${best} lbs`,C.amber,C.amberLight],["LATEST",`${latest?.weight} lbs`,C.accent,C.accentLight],["SESSIONS",sel.sessions.length,C.green,C.greenLight],trend!==null?[trend>=0?"GAINED":"CHANGE",`${trend>=0?"+":""}${trend} lbs`,trend>=0?C.green:C.red,trend>=0?C.greenLight:C.redLight]:null].filter(Boolean).map(([l,v,c,bg])=>(
              <div key={l} style={{flex:1,background:bg,borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                <div style={{fontSize:9,color:c,marginBottom:3,fontWeight:700,letterSpacing:"0.06em"}}>{l}</div>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>{v}</div>
              </div>
            ))}
          </div>
          {chartData.length>=1&&(
            <>
              <div style={{fontSize:11,color:C.mutedLight,fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>HEAVIEST SET PER SESSION</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{top:24,right:4,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:11}} domain={["auto","auto"]} axisLine={false} tickLine={false}/>
                  <Tooltip content={({active,payload,label})=>{if(!active||!payload?.length)return null;const d=payload[0].payload;return<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><div style={{color:C.muted,marginBottom:4}}>{label}</div><div style={{color:C.amber,fontWeight:600}}>{d.weight} lbs</div><div style={{color:C.text}}>{d.sets}×{d.reps}</div></div>;}}/>
                  <Bar dataKey="weight" radius={[6,6,0,0]} label={(props)=>{const{x,y,width,value,index}=props;const reps=chartData[index]?.reps;if(!value||!reps)return null;return<text x={x+width/2} y={y-6} fill={C.muted} textAnchor="middle" fontSize={11} fontFamily="-apple-system,sans-serif">{reps}r</text>;}}>{chartData.map((e,i)=><Cell key={i} fill={e.weight===best?C.amber:C.accent} opacity={0.85}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{fontSize:11,color:C.mutedLight,textAlign:"center",marginTop:6}}>Bar = weight · number = reps · <span style={{color:C.amber,fontWeight:600}}>gold = PR</span></div>
            </>
          )}
          <div style={{marginTop:18}}>
            <div style={{fontSize:11,color:C.mutedLight,fontWeight:700,letterSpacing:"0.08em",marginBottom:10}}>SESSION LOG</div>
            {[...sel.sessions].reverse().map((s,i)=>(
              <div key={i} style={{...rowSt}}>
                <span style={{color:C.muted,fontSize:14}}>{shortDate(s.date)}</span>
                <span style={{flex:1,marginLeft:10,fontSize:14}}>{s.weight?<>best: <span style={{color:s.weight===best?C.amber:C.accent,fontWeight:700}}>{s.weight} lbs × {s.reps}</span>{s.weight===best&&<span style={{fontSize:11,color:C.amber,marginLeft:4}}>★ PR</span>}</>:<span style={{color:C.accent,fontWeight:700}}>{s.sets} sets</span>}</span>
                <DeleteBtn onDelete={()=>{onDeleteSet(s.date,selected);if(sel.sessions.length<=1)setSelected(null);}} style={{marginLeft:8}}/>
              </div>
            ))}
          </div>
        </div>
      )}
      {!selected&&(
        <>
          <div style={{fontSize:13,color:C.muted,marginBottom:12}}>{filtered.length} exercise{filtered.length!==1?"s":""} · tap to view progress</div>
          {filtered.length===0&&<div style={{fontSize:14,color:C.muted,textAlign:"center",marginTop:48,whiteSpace:"pre-line"}}>{names.length===0?"No workouts logged yet.":(`No matches for "${search}"`)}</div>}
          {filtered.map(name=>{
            const ex=library[name];const pb=Math.max(...ex.sessions.map(s=>s.weight));const last=ex.sessions[ex.sessions.length-1];const up=ex.sessions.length>=2&&last.weight>ex.sessions[0].weight;const down=ex.sessions.length>=2&&last.weight<ex.sessions[0].weight;
            return(
              <div key={name} style={{...card,cursor:"pointer"}} onClick={()=>setSelected(name)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:16,fontWeight:600,color:C.text,textTransform:"capitalize",marginBottom:4}}>{name}</div>
                    <div style={{fontSize:13,color:C.muted}}>{ex.sessions.length} session{ex.sessions.length!==1?"s":""} · last: {shortDate(last.date)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:18,fontWeight:700,color:C.amber}}>{pb} lbs</div>
                    <div style={{fontSize:12,color:up?C.green:down?C.red:C.mutedLight,marginTop:2,fontWeight:500}}>{up?"▲ improving":down?"▼ declining":"—"}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ── Claude API ────────────────────────────────────────────────────────────────
function buildDataContext(workouts,nutrition,bodyweight,goals,exerciseMap){
  function res(raw){const l=raw.toLowerCase().trim();return exerciseMap[l]||HARD_ALIASES[l]||l;}
  const exS={};workouts.forEach(w=>{w.sets.forEach(s=>{const n=res(s.exercise);if(!exS[n])exS[n]=[];exS[n].push({date:w.date,weight:s.weight});});});
  const nutD={};nutrition.forEach(n=>{if(!nutD[n.date])nutD[n.date]={calories:0,protein_g:0};n.items.forEach(i=>{nutD[n.date].calories+=i.calories||0;nutD[n.date].protein_g+=i.protein_g||0;});});
  return`GOALS: ${goals.calories}cal | ${goals.protein_g}g protein\nEXERCISES:\n${Object.entries(exS).map(([n,s])=>{const sorted=s.sort((a,b)=>a.date.localeCompare(b.date));const best=Math.max(...s.map(x=>x.weight));const lat=sorted[sorted.length-1];return`- ${n}: ${s.length} sessions, best=${best}lbs, latest=${lat.weight}lbs on ${lat.date}`;}).join("\n")}\nNUTRITION:\n${Object.entries(nutD).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,14).map(([d,x])=>`- ${d}: ${Math.round(x.calories)}cal | ${Math.round(x.protein_g)}g pro`).join("\n")}\nBODYWEIGHT:\n${bodyweight.slice(-14).map(b=>`- ${b.date}: ${b.weight}lbs`).join("\n")||"No data"}`;
}

async function callClaudeImage(base64,mediaType){
  const res=await fetch("/api/anthropic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:500,system:`You are a nutrition label scanner. Extract data from the label and return ONLY valid JSON:\n{"name":"product name (be specific)","calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"servingSize":"string","servingUnit":"string","servingAmount":number}  servingUnit should be the countable unit (pieces, chips, crisps, crackers, cookies, gummies) NOT weight/volume (oz, g, ml, cup). servingAmount is how many of that unit equals one serving (e.g. if serving is 20 pieces, servingAmount=20). If no countable unit exists, use "serving" with servingAmount=1.\nAll numbers should be per single serving. No markdown, no preamble.`,messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mediaType,data:base64}},{type:"text",text:"Extract the nutrition info from this label."}]}]})});
  const data=await res.json();
  const text=data.content?.map(b=>b.text||"").join("")||"{}";
  try{return JSON.parse(text.replace(/```json|```/g,"").trim());}catch{return null;}
}

const COACH_SYSTEM_STATIC=`You are FitLog, a fitness chat assistant. The user logs workouts, food, and bodyweight by talking to you naturally. You have tools to record, edit, and query their data.

CORE BEHAVIOR
- If the user's intent is clear, call the appropriate tool and write ONE concise confirmation. Don't ask before logging straightforward items.
- For multiple actions in one message ("2 eggs and weighed 175"), call multiple tools in one turn.
- After tools run, write a short summary including macros for food, weights/sets for workouts. Use ✅ to confirm logs.
- NEVER claim you "logged" something without actually calling a tool. Actions only happen via tools.

FOOD LOGGING
- If a food fuzzy-matches an entry in CUSTOM FOODS below, use \`use_custom_food\` — never re-estimate macros for a custom food.
- For simple whole foods (plain chicken breast, plain rice, fresh fruit, raw vegetables), estimate from training knowledge and call \`log_food\` directly.
- For branded, packaged, restaurant, or processed items NOT in custom foods, estimate macros from your training knowledge and call \`log_food\` directly. Be as accurate as possible — use well-known nutritional data. Never guess 0 calories.
- When the user provides explicit macros (e.g. "protein bar 190cal 21p 18c 6f"), use those — call \`log_food\` directly.
- Quantity field: countable foods use piece+unit ("2 eggs", "3 slices"); otherwise servings ("1 cup", "1 serving").

WORKOUT LOGGING
- "bench 3x8 @ 185" → \`log_workout\` with exercise="bench", sets=3, reps=8, weight=185, unit="lbs".
- "chest - incline press - 4x10 @ 155" → muscleGroup="chest", exercise="incline press", sets=4, reps=10, weight=155.
- reps and weight are optional — use 0 if not given.
- Valid muscleGroup values: chest, back, shoulders, legs, biceps, triceps, core, cardio, kettlebell.
- For kettlebell-style work ("kb swing 5x10", "turkish get-up 3x3 @ 35"), use muscleGroup="kettlebell".

QUESTIONS
- For "how am I doing on protein?", "is my bench improving?", trend/summary questions — answer directly from CURRENT DATA below. No tool calls needed.

EDITING & DELETING
- Use RECENT NUTRITION ENTRIES below to find the right timestamp + item_index for \`edit_food_item\` / \`delete_food_item\`.
- If multiple entries could match the user's request, ask which one before acting.

CLARIFY ONLY WHEN GENUINELY AMBIGUOUS
- "I had dinner" with no specifics → ask what they ate.
- "Log my breakfast" with no specifics → ask what they ate.
- Otherwise, act.`;

const TOOLS=[
  {name:"log_food",description:"Log one or more food items to the user's nutrition diary for the current LOGGING DATE. Use this for foods NOT in the user's custom-foods library, or when the user states explicit macros.",input_schema:{type:"object",properties:{items:{type:"array",items:{type:"object",properties:{name:{type:"string"},calories:{type:"number"},protein_g:{type:"number"},carbs_g:{type:"number"},fat_g:{type:"number"},quantity:{type:"string",description:"e.g. '1 cup', '2 slices', '1 serving', '3 eggs'"}},required:["name","calories","protein_g","carbs_g","fat_g","quantity"]}},meal:{type:"string",enum:["breakfast","lunch","dinner","snack"]}},required:["items","meal"]}},
  {name:"use_custom_food",description:"Log a food that exists in the user's CUSTOM FOODS library. Macros come from the saved food, scaled by serving count or amount/unit. ALWAYS use this when the food matches a custom-food entry — do not call log_food for custom foods.",input_schema:{type:"object",properties:{name:{type:"string",description:"The custom food name (must fuzzy-match an entry in CUSTOM FOODS)"},meal:{type:"string",enum:["breakfast","lunch","dinner","snack"]},servings:{type:"number",description:"Number of full servings (e.g. 2 for '2 servings'). Default 1."},amount:{type:"number",description:"Numeric amount when user specifies units (e.g. 5 for '5 crisps'). Optional."},unit:{type:"string",description:"Unit when user specifies amount (e.g. 'crisps', 'pieces'). Optional."}},required:["name","meal"]}},
  {name:"create_custom_food",description:"Save a NEW custom food (built from listed ingredients) to the user's CUSTOM FOODS library. Use this when the user explicitly asks to save/define a new food made from ingredients (e.g. 'save my smoothie: ...').",input_schema:{type:"object",properties:{name:{type:"string"},ingredients:{type:"array",items:{type:"object",properties:{name:{type:"string"},calories:{type:"number"},protein_g:{type:"number"},carbs_g:{type:"number"},fat_g:{type:"number"},quantity:{type:"string"}},required:["name","calories","protein_g","carbs_g","fat_g","quantity"]}}},required:["name","ingredients"]}},
  {name:"log_workout",description:"Log workout sets to the current LOGGING DATE. Each entry is one exercise with set count, reps, weight.",input_schema:{type:"object",properties:{sets:{type:"array",items:{type:"object",properties:{exercise:{type:"string"},sets:{type:"number"},reps:{type:"number",description:"0 if not specified"},weight:{type:"number",description:"0 if not specified"},unit:{type:"string",enum:["lbs","kg"]},muscleGroup:{type:"string",enum:["chest","back","shoulders","legs","biceps","triceps","core","cardio","kettlebell"]}},required:["exercise","sets"]}}},required:["sets"]}},
  {name:"log_bodyweight",description:"Log the user's bodyweight in lbs for today.",input_schema:{type:"object",properties:{weight:{type:"number"}},required:["weight"]}},
  {name:"save_template",description:"Save a named meal template (a bundle of foods) for later reuse via use_template.",input_schema:{type:"object",properties:{name:{type:"string"},meal:{type:"string",enum:["breakfast","lunch","dinner","snack"]},items:{type:"array",items:{type:"object",properties:{name:{type:"string"},calories:{type:"number"},protein_g:{type:"number"},carbs_g:{type:"number"},fat_g:{type:"number"},quantity:{type:"string"}},required:["name","calories","protein_g","carbs_g","fat_g","quantity"]}}},required:["name","meal","items"]}},
  {name:"use_template",description:"Log a previously saved meal template, optionally scaled by servings.",input_schema:{type:"object",properties:{name:{type:"string"},servings:{type:"number",description:"Default 1"}},required:["name"]}},
  {name:"edit_food_item",description:"Edit a previously logged food item. Find the right entry via RECENT NUTRITION ENTRIES (timestamp + item_index).",input_schema:{type:"object",properties:{timestamp:{type:"number",description:"The entry timestamp shown in RECENT NUTRITION ENTRIES"},item_index:{type:"number"},updates:{type:"object",properties:{name:{type:"string"},quantity:{type:"string"},calories:{type:"number"},protein_g:{type:"number"},carbs_g:{type:"number"},fat_g:{type:"number"}}}},required:["timestamp","item_index","updates"]}},
  {name:"delete_food_item",description:"Delete a previously logged food item by timestamp + item_index.",input_schema:{type:"object",properties:{timestamp:{type:"number"},item_index:{type:"number"}},required:["timestamp","item_index"]}},
  {name:"set_goals",description:"Update the user's daily nutrition goals.",input_schema:{type:"object",properties:{calories:{type:"number"},protein_g:{type:"number"},carb_fat_split:{type:"number",description:"% of remaining calories from carbs (rest is fat). E.g. 60 = 60% carbs, 40% fat."}}}}
];

function buildDynamicContext({customFoods,workouts,nutrition,bodyweight,goals,exerciseMap,selectedDate}){
  const customList=Object.values(customFoods).slice(0,30);
  const customFoodsBlock=customList.length
    ?customList.map(f=>{
        const srv=f.servingUnit?`${getServingBase(f)} ${f.servingUnit} per serving`:(f.servingSize||"1 serving");
        return `- "${f.name}": ${f.calories}cal per serving (${srv}) | ${f.protein_g}g pro | ${f.carbs_g}g carbs | ${f.fat_g}g fat`;
      }).join("\n")
    :"(none yet)";
  const recentEntries=nutrition.slice(-15).map(n=>
    `- ${n.date} ${n.meal} ts=${n.timestamp}: ${n.items.map((i,idx)=>`[${idx}] ${i.quantity} ${i.name} ${i.calories}cal`).join("; ")}`
  ).join("\n")||"(none yet)";
  return `CUSTOM FOODS:\n${customFoodsBlock}\n\nCURRENT DATA:\n${buildDataContext(workouts,nutrition,bodyweight,goals,exerciseMap)}\n\nRECENT NUTRITION ENTRIES (for edit/delete reference):\n${recentEntries}\n\nLOGGING DATE: ${selectedDate}\nTODAY: ${today()}`;
}

async function callClaudeAgent(messages,dynamicContext){
  const lastIdx=TOOLS.length-1;
  const tools=[
    ...TOOLS.slice(0,lastIdx),
    {...TOOLS[lastIdx],cache_control:{type:"ephemeral"}}
  ];
  const res=await fetch("/api/anthropic",{
    method:"POST",
    headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01"},
    body:JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:1500,
      system:[
        {type:"text",text:COACH_SYSTEM_STATIC,cache_control:{type:"ephemeral"}},
        {type:"text",text:dynamicContext}
      ],
      tools,
      messages
    })
  });
  return await res.json();
}

// Returns how many units constitute one "serving" for a custom food.
// Prefers the count embedded in servingSize ("20 crisps" → 20) over the raw
// servingAmount field, because saved foods may have a stale servingAmount from
// the label scan that doesn't match the scaled calories stored.
function getServingBase(food) {
  if (food.servingUnit && food.servingSize) {
    const re = new RegExp(`(\\d+\\.?\\d*)\\s*${food.servingUnit}s?`, 'i');
    const m = food.servingSize.match(re);
    if (m) return parseFloat(m[1]);
  }
  return food.servingAmount || 1;
}

function fuzzyFoodMatch(a, b) {
  a = a.toLowerCase().trim(); b = b.toLowerCase().trim();
  if (a === b) return 1.0;
  // Substring counts only when the shorter string is most of the longer one,
  // so "shake" can't shadow "elevation protein shake".
  if (a.includes(b) || b.includes(a)) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    if (ratio >= 0.6) return 0.9;
  }
  const aW = new Set(a.split(/\s+/).filter(w => w.length > 2));
  const bW = new Set(b.split(/\s+/).filter(w => w.length > 2));
  if (!aW.size || !bW.size) return 0;
  const intersect = [...aW].filter(w => bW.has(w)).length;
  const union = new Set([...aW, ...bW]).size;
  return intersect / union;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function FitLog(){
  const[tab,setTab]=useState("chat");
  const[input,setInput]=useState("");
  const[messages,setMessages]=useState([
    {role:"assistant",content:"Hey! Log workouts, food, or bodyweight — or ask me anything.\n\n• \"Bench 3x8 at 185\"\n• \"Lunch: chicken breast, rice\"\n• \"Protein bar, 190cal, 21g protein, 18g carbs, 6g fat\"\n• \"175 lbs\" to log bodyweight\n• 📷 Scan a nutrition label\n• \"Is my bench improving?\"",type:"intro"}
  ]);
  const[workouts,setWorkouts]=useState([]);   const[weeklySets,setWeeklySets]=useState({});
  const[nutrition,setNutrition]=useState([]);
  const[bodyweight,setBW]=useState([]);
  const[goals,setGoals]=useState(DEFAULT_GOALS);
  const[templates,setTemplates]=useState({});
  const[exerciseMap,setExerciseMap]=useState({});
  const[muscleOverrides,setMuscleOverrides]=useState({});
  const[customFoods,setCustomFoods]=useState({});
  const[draftCals,setDraftCals]=useState(String(DEFAULT_GOALS.calories));
  const[draftPro,setDraftPro]=useState(String(DEFAULT_GOALS.protein_g));
  const[draftSplit,setDraftSplit]=useState(DEFAULT_GOALS.carbFatSplit);
  const[loading,setLoading]=useState(false);
  const[context,setContext]=useState([]);
  const[bwInput,setBwInput]=useState("");   const[selectedDate,setSelectedDate]=useState(today());
  const[savedFlash,setSavedFlash]=useState(false);   const[weekOffset,setWeekOffset]=useState(0);
  const[confirmModal,setConfirmModal]=useState(null);
  const[labelModal,setLabelModal]=useState(null);
  const[saveFoodPrompt,setSaveFoodPrompt]=useState(null);
  const[editFoodModal,setEditFoodModal]=useState(null);
  const[editCustomFoodModal,setEditCustomFoodModal]=useState(null);
  const bottomRef=useRef(null);
  const inputRef=useRef(null);
  const fileRef=useRef(null);
  const stateRef=useRef({workouts:[],nutrition:[],bodyweight:[],customFoods:{},templates:{},goals:DEFAULT_GOALS,exerciseMap:{},muscleOverrides:{}});

  useEffect(()=>{
    function applyData(src){
      const g=v=>src?.[v];
      setWorkouts(g(STORAGE_KEYS.workouts)??load(STORAGE_KEYS.workouts,[]));
      setWeeklySets(g(STORAGE_KEYS.weeklysets)??load(STORAGE_KEYS.weeklysets,{}));
      setNutrition(g(STORAGE_KEYS.nutrition)??load(STORAGE_KEYS.nutrition,[]));
      setBW(g(STORAGE_KEYS.bodyweight)??load(STORAGE_KEYS.bodyweight,[]));
      setTemplates(g(STORAGE_KEYS.templates)??load(STORAGE_KEYS.templates,{}));
      setExerciseMap(g(STORAGE_KEYS.exerciseMap)??load(STORAGE_KEYS.exerciseMap,{}));
      setMuscleOverrides(g(STORAGE_KEYS.muscleOverrides)??load(STORAGE_KEYS.muscleOverrides,{}));
      setCustomFoods(g(STORAGE_KEYS.customFoods)??load(STORAGE_KEYS.customFoods,{}));
      const goals_=g(STORAGE_KEYS.goals)??load(STORAGE_KEYS.goals,DEFAULT_GOALS);
      setGoals(goals_);setDraftCals(String(goals_.calories));setDraftPro(String(goals_.protein_g));setDraftSplit(goals_.carbFatSplit??60);
      if(src){for(const[k,v]of Object.entries(src))localStorage.setItem(k,JSON.stringify(v));}
    }
    loadFromBin().then(remote=>{
      if(remote&&Object.keys(remote).length>1)applyData(remote);
      else applyData(null);
    });
  },[]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  useEffect(()=>{
    stateRef.current={workouts,nutrition,bodyweight,customFoods,templates,goals,exerciseMap,muscleOverrides};
  },[workouts,nutrition,bodyweight,customFoods,templates,goals,exerciseMap,muscleOverrides]);

  function resolveEx(raw,map=exerciseMap){const l=raw.toLowerCase().trim();return map[l]||HARD_ALIASES[l]||l;}
  function getKnownExercises(map=exerciseMap){const s=new Set();workouts.forEach(w=>w.sets.forEach(x=>s.add(resolveEx(x.exercise,map))));return[...s];}

  function deleteNutritionEntry(timestamp){const updated=nutrition.filter(n=>n.timestamp!==timestamp);setNutrition(updated);save(STORAGE_KEYS.nutrition,updated);}
  function deleteNutritionItem(entryTimestamp,itemIndex){const updated=nutrition.map(n=>{if(n.timestamp!==entryTimestamp)return n;const newItems=n.items.filter((_,i)=>i!==itemIndex);return{...n,items:newItems};}).filter(n=>n.items.length>0);setNutrition(updated);save(STORAGE_KEYS.nutrition,updated);}
  function editNutritionItem(entryTimestamp,itemIndex,updates){const updated=nutrition.map(n=>{if(n.timestamp!==entryTimestamp)return n;return{...n,items:n.items.map((it,i)=>i===itemIndex?{...it,...updates}:it)};});setNutrition(updated);save(STORAGE_KEYS.nutrition,updated);}
  function editCustomFood(originalName,updates){
    const oldKey=originalName.toLowerCase();
    const newKey=(updates.name||originalName).toLowerCase();
    const existing=customFoods[oldKey]||{};
    const merged={...existing,...updates};
    const next={...customFoods};
    if(newKey!==oldKey){
      if(next[newKey]){alert(`A saved food named "${updates.name}" already exists.`);return false;}
      delete next[oldKey];
    }
    next[newKey]=merged;
    setCustomFoods(next);save(STORAGE_KEYS.customFoods,next);
    return true;
  }
  function deleteWorkoutEntry(timestamp){const updated=workouts.filter(w=>w.timestamp!==timestamp);setWorkouts(updated);save(STORAGE_KEYS.workouts,updated);}
  function deleteWorkoutSet(date,exerciseName){const updated=workouts.map(w=>{if(w.date!==date)return w;const newSets=w.sets.filter(s=>{const resolved=resolveEx(s.exercise);return resolved!==exerciseName&&s.exercise.toLowerCase().trim()!==exerciseName;});return{...w,sets:newSets};}).filter(w=>w.sets.length>0);setWorkouts(updated);save(STORAGE_KEYS.workouts,updated);}

  function commitWorkout(sets,overrides=muscleOverrides){
    const entry={date:selectedDate,timestamp:Date.now(),sets};
    const u=[...workouts,entry];setWorkouts(u);save(STORAGE_KEYS.workouts,u);
    const weekKey=selectedDate.slice(0,7);const updated={...weeklySets};if(!updated[weekKey])updated[weekKey]={};sets.forEach(s=>{const mg=getMuscleGroup(s.exercise,overrides);updated[weekKey][mg]=(updated[weekKey][mg]||0)+s.sets;});setWeeklySets(updated);save(STORAGE_KEYS.weeklysets,updated);
    const fmtSet=s=>s.weight?`${s.sets}×${s.reps} @ ${s.weight}${s.unit}`:s.reps?`${s.sets}×${s.reps}`:`${s.sets} sets`;
    const reply=`✅ Workout logged!\n${sets.map(s=>`  • ${s.exercise}: ${fmtSet(s)}`).join("\n")}`;
    setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"workout"}]);
  }

  function processExQueue(queue,resolved,map,overrides=muscleOverrides){
    if(queue.length===0){commitWorkout(resolved,overrides);setConfirmModal(null);return;}
    const[next,...rest]=queue;
    const known=getKnownExercises(map);
    const lower=next.exercise.toLowerCase().trim();
    if(next.muscleGroup&&VALID_MUSCLE_GROUPS.includes(next.muscleGroup)){
      const resolvedName=resolveEx(lower,map);
      const newOverrides={...overrides,[resolvedName]:next.muscleGroup};
      setMuscleOverrides(newOverrides);save(STORAGE_KEYS.muscleOverrides,newOverrides);
      processExQueue(rest,[...resolved,{...next,exercise:resolvedName}],map,newOverrides);
    }else if(map[lower]||HARD_ALIASES[lower]){processExQueue(rest,[...resolved,{...next,exercise:resolveEx(lower,map)}],map,overrides);}
    else{const sim=findSimilarExercise(lower,known);if(sim&&sim!==lower){setConfirmModal({incoming:lower,existing:sim,set:next,remainingQueue:rest,resolvedSets:resolved,currentMap:map,currentOverrides:overrides});}else processExQueue(rest,[...resolved,{...next,exercise:lower}],map,overrides);}
  }

  function handleSameEx(){if(!confirmModal)return;const{incoming,existing,set,remainingQueue,resolvedSets,currentMap,currentOverrides=muscleOverrides}=confirmModal;const nm={...currentMap,[incoming]:existing};setExerciseMap(nm);save(STORAGE_KEYS.exerciseMap,nm);processExQueue(remainingQueue,[...resolvedSets,{...set,exercise:existing}],nm,currentOverrides);}
  function handleDiffEx(){if(!confirmModal)return;const{incoming,set,remainingQueue,resolvedSets,currentMap,currentOverrides=muscleOverrides}=confirmModal;const nm={...currentMap,[incoming]:incoming};setExerciseMap(nm);save(STORAGE_KEYS.exerciseMap,nm);processExQueue(remainingQueue,[...resolvedSets,{...set,exercise:incoming}],nm,currentOverrides);}

  function logFoodItem(item,meal,promptSave=false){
    const entry={date:selectedDate,timestamp:Date.now(),meal,items:[item]};
    const u=[...nutrition,entry];setNutrition(u);save(STORAGE_KEYS.nutrition,u);
    const reply=`✅ ${meal.charAt(0).toUpperCase()+meal.slice(1)} logged!\n  • ${item.quantity} ${item.name}: ${item.calories} cal\n${item.protein_g}g protein · ${item.carbs_g}g carbs · ${item.fat_g}g fat`;
    setMessages(prev=>[...prev,{role:"assistant",content:reply,type:"nutrition"}]);
    if(promptSave&&!customFoods[item.name.toLowerCase()]){setSaveFoodPrompt({food:item,meal});}else{console.log("save prompt blocked - promptSave:",promptSave,"exists:",!!customFoods[item.name.toLowerCase()]);}
  }

  function saveCustomFood(food){
    const key=food.name.toLowerCase();
    // Align servingAmount to the unit count in the logged quantity so future
    // calculations don't apply a stale multiplier from the original label scan.
    let servingAmt=food.servingAmount||1;
    if(food.servingUnit&&food.quantity){
      const re=new RegExp(`(\\d+\\.?\\d*)\\s*${food.servingUnit}s?`,'i');
      const m=food.quantity.match(re);
      if(m)servingAmt=parseFloat(m[1])||servingAmt;
    }
    const updated={...customFoods,[key]:{...food,servingSize:food.quantity||"1 serving",servingUnit:food.servingUnit||null,servingAmount:servingAmt}};
    setCustomFoods(updated);save(STORAGE_KEYS.customFoods,updated);
    setMessages(prev=>[...prev,{role:"assistant",content:`📌 "${food.name}" saved to your Foods library.`,type:"info"}]);
    setSaveFoodPrompt(null);
  }

  async function handleImageUpload(e){
    const file=e.target.files?.[0];if(!file)return;e.target.value="";
    setLoading(true);
    setMessages(prev=>[...prev,{role:"user",content:"📷 [nutrition label photo]"},{role:"assistant",content:"Scanning label...",type:"info"}]);
    try{
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      const scanned=await callClaudeImage(base64,file.type||"image/jpeg");
      if(scanned&&scanned.calories){setMessages(prev=>[...prev.slice(0,-1)]);setLabelModal(scanned);}
      else{setMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:"Couldn't read that label clearly. Try a closer, well-lit photo.",type:"unclear"}]);}
    }catch{setMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:"Something went wrong scanning the label.",type:"error"}]);}
    setLoading(false);
  }

  function handleLabelConfirm(scaled){setLabelModal(null);logFoodItem({...scaled,quantity:`${scaled.quantity}`,servingUnit:labelModal?.servingUnit||null,servingAmount:labelModal?.servingAmount||1},"snack",true);}

  const doLogBW=val=>{const n=parseFloat(val);if(isNaN(n)||n<50||n>500)return null;const entry={date:today(),weight:n,unit:"lbs",timestamp:Date.now()};const updated=[...bodyweight.filter(b=>b.date!==today()),entry].sort((a,b)=>a.date.localeCompare(b.date));setBW(updated);save(STORAGE_KEYS.bodyweight,updated);return n;};
  const saveGoals=()=>{const c=Math.max(0,parseInt(draftCals)||0),p=Math.max(0,parseInt(draftPro)||0),d=calcMacros(c,p,draftSplit),g={calories:c,protein_g:p,carbs_g:d.carbs_g,fat_g:d.fat_g,carbFatSplit:draftSplit};setGoals(g);save(STORAGE_KEYS.goals,g);setSavedFlash(true);setTimeout(()=>setSavedFlash(false),1800);};

  function dispatchTool(name,input){
    const cur=stateRef.current;
    try{
      switch(name){
        case"log_food":{
          const meal=input.meal||"snack";
          const items=(input.items||[]).map(it=>({
            name:it.name,
            calories:Math.round(it.calories||0),
            protein_g:Math.round(it.protein_g||0),
            carbs_g:Math.round(it.carbs_g||0),
            fat_g:Math.round(it.fat_g||0),
            quantity:it.quantity||"1 serving",
          }));
          if(!items.length)return{error:"No items provided"};
          const entry={date:selectedDate,timestamp:Date.now(),meal,items};
          const updated=[...cur.nutrition,entry];
          stateRef.current={...cur,nutrition:updated};
          setNutrition(updated);save(STORAGE_KEYS.nutrition,updated);
          if(!cur.customFoods[items[0].name.toLowerCase()]){
            setSaveFoodPrompt({food:items[0],meal});
          }
          return{ok:true,timestamp:entry.timestamp,logged:items.map(i=>`${i.quantity} ${i.name} (${i.calories}cal)`)};
        }
        case"use_custom_food":{
          const key=(input.name||"").toLowerCase();
          const customFoods=cur.customFoods;
          const bestMatch=Object.keys(customFoods).reduce((best,k)=>{const score=fuzzyFoodMatch(key,k);return score>best.score?{key:k,score}:best;},{key:null,score:0.45});
          if(!bestMatch.key)return{error:`No custom food matching "${input.name}". Available: ${Object.keys(customFoods).join(", ")||"(none)"}`};
          const food=customFoods[bestMatch.key];
          let mult=input.servings||1;
          if(input.amount&&input.unit){
            if(food.servingUnit&&input.unit.toLowerCase().includes(food.servingUnit.toLowerCase())){
              mult=input.amount/getServingBase(food);
            }else if(!food.servingUnit&&food.servingSize){
              const sRe=new RegExp(`(\\d+\\.?\\d*)\\s*${input.unit}s?`,'i');
              const sm=food.servingSize.match(sRe);
              if(sm){const base=parseFloat(sm[1]);if(base>0)mult=input.amount/base;}
            }
          }
          const item={
            name:food.name,
            calories:Math.round(food.calories*mult),
            protein_g:Math.round(food.protein_g*mult),
            carbs_g:Math.round(food.carbs_g*mult),
            fat_g:Math.round(food.fat_g*mult),
            quantity:input.amount&&input.unit?`${input.amount} ${input.unit}`:`${mult} serving${mult!==1?"s":""}`,
          };
          const meal=input.meal||"snack";
          const entry={date:selectedDate,timestamp:Date.now(),meal,items:[item]};
          const updated=[...cur.nutrition,entry];
          stateRef.current={...cur,nutrition:updated};
          setNutrition(updated);save(STORAGE_KEYS.nutrition,updated);
          return{ok:true,timestamp:entry.timestamp,logged:`${item.quantity} ${item.name} (${item.calories}cal)`};
        }
        case"create_custom_food":{
          const ingredients=input.ingredients||[];
          const totals=ingredients.reduce((a,i)=>({calories:a.calories+(i.calories||0),protein_g:a.protein_g+(i.protein_g||0),carbs_g:a.carbs_g+(i.carbs_g||0),fat_g:a.fat_g+(i.fat_g||0)}),{calories:0,protein_g:0,carbs_g:0,fat_g:0});
          const food={name:input.name,calories:Math.round(totals.calories),protein_g:Math.round(totals.protein_g),carbs_g:Math.round(totals.carbs_g),fat_g:Math.round(totals.fat_g),servingSize:"1 serving",servingUnit:null,servingAmount:1};
          const k=input.name.toLowerCase();
          const updated={...cur.customFoods,[k]:food};
          stateRef.current={...cur,customFoods:updated};
          setCustomFoods(updated);save(STORAGE_KEYS.customFoods,updated);
          return{ok:true,name:food.name,totals:{calories:food.calories,protein_g:food.protein_g,carbs_g:food.carbs_g,fat_g:food.fat_g}};
        }
        case"log_workout":{
          const sets=input.sets||[];
          if(!sets.length)return{error:"No sets provided"};
          processExQueue(sets,[],cur.exerciseMap);
          return{ok:true,sets_queued:sets.length,note:"App will display the workout confirmation directly. You do NOT need to write a further confirmation."};
        }
        case"log_bodyweight":{
          const val=doLogBW(String(input.weight));
          if(!val)return{error:"Weight value out of range (50-500 lbs)"};
          return{ok:true,weight:val};
        }
        case"save_template":{
          const tname=(input.name||"unnamed").toLowerCase();
          const updated={...cur.templates,[tname]:{name:tname,meal:input.meal,items:input.items}};
          stateRef.current={...cur,templates:updated};
          setTemplates(updated);save(STORAGE_KEYS.templates,updated);
          return{ok:true,name:tname};
        }
        case"use_template":{
          const tname=(input.name||"").toLowerCase();
          const match=Object.keys(cur.templates).find(k=>tname.includes(k)||k.includes(tname));
          if(!match)return{error:Object.keys(cur.templates).length?`No template "${input.name}". Saved: ${Object.keys(cur.templates).join(", ")}`:"No templates saved yet."};
          const tmpl=cur.templates[match];
          const mult=input.servings||1;
          const items=tmpl.items.map(i=>({...i,calories:Math.round(i.calories*mult),protein_g:Math.round(i.protein_g*mult),carbs_g:Math.round(i.carbs_g*mult),fat_g:Math.round(i.fat_g*mult)}));
          const entry={date:selectedDate,timestamp:Date.now(),meal:tmpl.meal,items};
          const updated=[...cur.nutrition,entry];
          stateRef.current={...cur,nutrition:updated};
          setNutrition(updated);save(STORAGE_KEYS.nutrition,updated);
          const tot=items.reduce((a,i)=>({cal:a.cal+(i.calories||0),p:a.p+(i.protein_g||0)}),{cal:0,p:0});
          return{ok:true,name:match,timestamp:entry.timestamp,totals:{calories:tot.cal,protein_g:Math.round(tot.p)}};
        }
        case"edit_food_item":{
          const entry=cur.nutrition.find(n=>n.timestamp===input.timestamp);
          if(!entry)return{error:"No nutrition entry with that timestamp"};
          if(input.item_index>=entry.items.length||input.item_index<0)return{error:"item_index out of range"};
          const u=input.updates||{};
          const cleanUpdates={};
          if(u.name!==undefined)cleanUpdates.name=u.name;
          if(u.quantity!==undefined)cleanUpdates.quantity=u.quantity;
          if(u.calories!==undefined)cleanUpdates.calories=Math.max(0,Math.round(u.calories));
          if(u.protein_g!==undefined)cleanUpdates.protein_g=Math.max(0,Math.round(u.protein_g));
          if(u.carbs_g!==undefined)cleanUpdates.carbs_g=Math.max(0,Math.round(u.carbs_g));
          if(u.fat_g!==undefined)cleanUpdates.fat_g=Math.max(0,Math.round(u.fat_g));
          const newNutrition=cur.nutrition.map(n=>{
            if(n.timestamp!==input.timestamp)return n;
            return{...n,items:n.items.map((it,i)=>i===input.item_index?{...it,...cleanUpdates}:it)};
          });
          stateRef.current={...cur,nutrition:newNutrition};
          setNutrition(newNutrition);save(STORAGE_KEYS.nutrition,newNutrition);
          return{ok:true,updated:cleanUpdates};
        }
        case"delete_food_item":{
          const entry=cur.nutrition.find(n=>n.timestamp===input.timestamp);
          if(!entry)return{error:"No nutrition entry with that timestamp"};
          const newNutrition=cur.nutrition.map(n=>{
            if(n.timestamp!==input.timestamp)return n;
            return{...n,items:n.items.filter((_,i)=>i!==input.item_index)};
          }).filter(n=>n.items.length>0);
          stateRef.current={...cur,nutrition:newNutrition};
          setNutrition(newNutrition);save(STORAGE_KEYS.nutrition,newNutrition);
          return{ok:true};
        }
        case"set_goals":{
          const newGoals={...cur.goals};
          if(input.calories!==undefined)newGoals.calories=Math.max(0,Math.round(input.calories));
          if(input.protein_g!==undefined)newGoals.protein_g=Math.max(0,Math.round(input.protein_g));
          if(input.carb_fat_split!==undefined)newGoals.carbFatSplit=Math.max(0,Math.min(100,input.carb_fat_split));
          const macros=calcMacros(newGoals.calories,newGoals.protein_g,newGoals.carbFatSplit);
          newGoals.carbs_g=macros.carbs_g;newGoals.fat_g=macros.fat_g;
          stateRef.current={...cur,goals:newGoals};
          setGoals(newGoals);save(STORAGE_KEYS.goals,newGoals);
          setDraftCals(String(newGoals.calories));
          setDraftPro(String(newGoals.protein_g));
          setDraftSplit(newGoals.carbFatSplit);
          return{ok:true,goals:newGoals};
        }
        default:
          return{error:`Unknown tool: ${name}`};
      }
    }catch(e){
      return{error:e?.message||"Tool execution failed"};
    }
  }

  function inferBubbleType(toolsFired){
    if(toolsFired.includes("log_workout"))return"workout";
    if(toolsFired.some(t=>["log_food","use_custom_food","use_template","edit_food_item","delete_food_item"].includes(t)))return"nutrition";
    if(toolsFired.includes("log_bodyweight"))return"bodyweight";
    return"info";
  }

  function capContext(msgs,target=24){
    if(msgs.length<=target)return msgs;
    for(let i=msgs.length-target;i>=0;i--){
      const m=msgs[i];
      if(m.role==="user"&&typeof m.content==="string")return msgs.slice(i);
    }
    return msgs;
  }

  async function runAgentTurn(userText){
    const userMessage={role:"user",content:userText};
    let convo=[...context,userMessage];
    const dynamicCtx=buildDynamicContext({
      customFoods:stateRef.current.customFoods,
      workouts:stateRef.current.workouts,
      nutrition:stateRef.current.nutrition,
      bodyweight:stateRef.current.bodyweight,
      goals:stateRef.current.goals,
      exerciseMap:stateRef.current.exerciseMap,
      selectedDate,
    });
    const toolsFired=[];
    const MAX_STEPS=6;
    for(let step=0;step<MAX_STEPS;step++){
      let res;
      try{
        res=await callClaudeAgent(convo,dynamicCtx);
      }catch{
        setMessages(prev=>[...prev,{role:"assistant",content:"Network error — try again.",type:"error"}]);
        return;
      }
      if(res?.type==="error"||res?.error){
        const errMsg=res?.error?.message||res?.error||"API error";
        setMessages(prev=>[...prev,{role:"assistant",content:`API error: ${errMsg}`,type:"error"}]);
        return;
      }
      const assistantBlocks=res.content||[];
      const textBlocks=assistantBlocks.filter(b=>b.type==="text").map(b=>b.text).filter(t=>t&&t.trim());
      const toolUses=assistantBlocks.filter(b=>b.type==="tool_use");
      convo=[...convo,{role:"assistant",content:assistantBlocks}];
      if(toolUses.length===0){
        const text=textBlocks.join("\n\n").trim();
        if(text){
          const type=inferBubbleType(toolsFired);
          setMessages(prev=>[...prev,{role:"assistant",content:text,type}]);
        }
        setContext(capContext(convo));
        return;
      }
      if(textBlocks.length){
        const type=inferBubbleType(toolsFired);
        textBlocks.forEach(t=>setMessages(prev=>[...prev,{role:"assistant",content:t,type}]));
      }
      const toolResults=[];
      for(const tu of toolUses){

        toolsFired.push(tu.name);
        const result=dispatchTool(tu.name,tu.input);
        toolResults.push({
          type:"tool_result",
          tool_use_id:tu.id,
          content:JSON.stringify(result),
          ...(result&&result.error?{is_error:true}:{}),
        });
      }
      if(toolResults.length===0)continue;
      convo=[...convo,{role:"user",content:toolResults}];
    }
    setMessages(prev=>[...prev,{role:"assistant",content:"I got stuck — try rephrasing?",type:"error"}]);
    setContext(capContext(convo));
  }

  const handleSend=async()=>{
    if(!input.trim()||loading)return;
    const userMsg=input.trim();setInput("");
    setMessages(prev=>[...prev,{role:"user",content:userMsg}]);
    setLoading(true);
    try{
      await runAgentTurn(userMsg);
    }catch(e){
      setMessages(prev=>[...prev,{role:"assistant",content:"Something went wrong, try again.",type:"error"}]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i)-(weekOffset*7));return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;});
  const wkCal=days.map(d=>({date:shortDate(d),cal:Math.round(nutrition.filter(n=>n.date===d).reduce((a,e)=>a+e.items.reduce((b,i)=>b+(i.calories||0),0),0))}));
  const wkPro=days.map(d=>({date:shortDate(d),protein:Math.round(nutrition.filter(n=>n.date===d).reduce((a,e)=>a+e.items.reduce((b,i)=>b+(i.protein_g||0),0),0))}));
  const wkVol=days.map(d=>({date:shortDate(d),volume:Math.round(workouts.filter(w=>w.date===d).reduce((a,w)=>a+w.sets.reduce((b,s)=>b+(s.sets*s.reps*s.weight),0),0))}));
  const bwChart=days.map(d=>{const e=bodyweight.find(b=>b.date===d);return e?{date:shortDate(d),weight:e.weight}:null;}).filter(Boolean);
  const latestBW=bodyweight.length?bodyweight[bodyweight.length-1]:null;
  const previewC=Math.max(0,parseInt(draftCals)||0),previewP=Math.max(0,parseInt(draftPro)||0);
  const previewD=calcMacros(previewC,previewP,draftSplit);
  const proteinCals=previewP*4,remainCals=Math.max(0,previewC-proteinCals),proteinPct=previewC>0?Math.round((proteinCals/previewC)*100):0;
  const todayNut=nutrition.filter(n=>n.date===selectedDate);
  const todayWork=workouts.filter(w=>w.date===selectedDate);
  const todayMacros=todayNut.reduce((acc,e)=>{e.items.forEach(i=>{acc.calories+=i.calories||0;acc.protein_g+=i.protein_g||0;acc.carbs_g+=i.carbs_g||0;acc.fat_g+=i.fat_g||0;});return acc;},{calories:0,protein_g:0,carbs_g:0,fat_g:0});

  const tabSt=a=>({flex:1,padding:"11px 0",background:"none",border:"none",borderBottom:a?`2px solid ${C.accent}`:"2px solid transparent",color:a?C.accent:C.muted,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"inherit",letterSpacing:"0.04em",textTransform:"uppercase",transition:"all 0.15s"});
  const aiBubble=t=>({alignSelf:"flex-start",background:t==="workout"?C.greenLight:t==="nutrition"?C.amberLight:t==="bodyweight"?C.accentLight:C.surface,border:`1px solid ${t==="workout"?C.green:t==="nutrition"?C.amber:t==="bodyweight"?C.accent:C.border}`,borderRadius:"18px 18px 18px 4px",padding:"12px 16px",maxWidth:"86%",fontSize:15,whiteSpace:"pre-wrap",lineHeight:1.7,color:C.text,boxShadow:"0 1px 3px rgba(0,0,0,0.05)"});

  return(
    <div style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:C.bg,color:C.text,height:"100svh",display:"flex",flexDirection:"column",overflow:"hidden",maxWidth:480,margin:"0 auto"}}>
      {confirmModal&&<ExerciseConfirmModal incoming={confirmModal.incoming} existing={confirmModal.existing} onSame={handleSameEx} onDifferent={handleDiffEx}/>}
      {labelModal&&<LabelConfirmModal scanned={labelModal} onConfirm={handleLabelConfirm} onCancel={()=>setLabelModal(null)}/>}
      {editFoodModal&&<EditFoodModal item={editFoodModal.item} onSave={(updates)=>{editNutritionItem(editFoodModal.entryTimestamp,editFoodModal.itemIndex,updates);setEditFoodModal(null);}} onCancel={()=>setEditFoodModal(null)}/>}
      {editCustomFoodModal&&<EditCustomFoodModal food={editCustomFoodModal} onSave={(updates)=>{if(editCustomFood(editCustomFoodModal.name,updates)!==false)setEditCustomFoodModal(null);}} onCancel={()=>setEditCustomFoodModal(null)}/>}

      <div style={{padding:"16px 18px 12px",background:C.surface,borderBottom:`1px solid ${C.border}`,flexShrink:0,boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
        <p style={{fontSize:20,fontWeight:800,color:C.text,margin:0,letterSpacing:"-0.02em"}}>⚡ FitLog</p>
      </div>

      {tab==="chat"&&(<>
        <div style={{flex:1,overflowY:"auto",padding:"14px 14px 0",display:"flex",flexDirection:"column",gap:10}}>           {selectedDate!==today()&&<div style={{background:C.amberLight,border:`1px solid ${C.amber}`,borderRadius:12,padding:"10px 14px",fontSize:13,color:C.amber,fontWeight:600,textAlign:"center"}}>Logging to {selectedDate} — <span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setSelectedDate(today())}>switch to today</span></div>}
          {messages.map((m,i)=>m.role==="user"
            ?<div key={i} style={{alignSelf:"flex-end",background:C.accent,color:"#fff",borderRadius:"18px 18px 4px 18px",padding:"12px 16px",maxWidth:"80%",fontSize:15,fontWeight:500,whiteSpace:"pre-wrap",lineHeight:1.5}}>{m.content}</div>
            :<div key={i} style={aiBubble(m.type)}>{m.content}</div>
          )}
          {loading&&<div style={aiBubble("info")}>⏳ thinking...</div>}
          {saveFoodPrompt&&<SaveFoodPrompt food={saveFoodPrompt.food} onSave={()=>saveCustomFood(saveFoodPrompt.food)} onSkip={()=>setSaveFoodPrompt(null)}/>}
          <div ref={bottomRef}/>
        </div>
        <div style={{padding:"12px 14px 24px",display:"flex",gap:10,background:C.surface,borderTop:`1px solid ${C.border}`,flexShrink:0,alignItems:"center",boxShadow:"0 -1px 3px rgba(0,0,0,0.06)"}}>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageUpload}/>
          <button style={{background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,width:46,height:46,cursor:"pointer",fontSize:20,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>fileRef.current?.click()} title="Scan nutrition label">📷</button>
          <input ref={inputRef} style={{flex:1,background:C.bg,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.text,fontSize:16,fontFamily:"inherit",outline:"none"}} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="Log food, workout, or ask..."/>
          <button style={{background:C.accent,border:"none",borderRadius:12,width:46,height:46,cursor:"pointer",color:"#fff",fontWeight:700,fontSize:19,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={handleSend}>→</button>
        </div>
      </>)}

      {tab==="dashboard"&&(
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          <div style={{...card,textAlign:"center"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>             <div style={ctitle}>Calories Today</div>             <input type="date" value={selectedDate} max={today()} onChange={e=>setSelectedDate(e.target.value)} style={{fontSize:13,color:C.muted,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 8px",background:C.bg,fontFamily:"inherit"}}/>           </div><CalorieRing consumed={Math.round(todayMacros.calories)} goal={goals.calories}/></div>
          <div style={card}>
            <div style={ctitle}>Macros</div>
            <MacroBar label="Protein" value={todayMacros.protein_g} goal={goals.protein_g} color={C.accent}/>
            <MacroBar label="Carbs" value={todayMacros.carbs_g} goal={goals.carbs_g} color={C.purple}/>
            <MacroBar label="Fat" value={todayMacros.fat_g} goal={goals.fat_g} color={C.orange}/>
          </div>
          <div style={card}>
            <div style={ctitle}>⚖️ Bodyweight{latestBW?` — ${latestBW.weight} lbs (${latestBW.date===today()?"today":latestBW.date})`:""}</div>
            <div style={{display:"flex",gap:10}}>
              <input style={{...inp,flex:1}} type="number" placeholder="Enter weight (lbs)" value={bwInput} onChange={e=>setBwInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){doLogBW(bwInput);setBwInput("");}}}/>
              <button style={{background:C.accent,border:"none",borderRadius:12,padding:"12px 18px",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:15,cursor:"pointer"}} onClick={()=>{doLogBW(bwInput);setBwInput("");}}>Log</button>
            </div>
          </div>
          <div style={card}>
            <div style={ctitle}>Today's Workout</div>
            {todayWork.length===0
              ?<div style={{fontSize:15,color:C.muted}}>No workout logged yet.</div>
              :todayWork.map((workout,wi)=>(
                <div key={workout.timestamp||wi}>
                  {workout.sets.map((s,si)=>(
                    <div key={si} style={{...rowSt,gap:10}}>
                      <span style={{textTransform:"capitalize",color:C.accent,fontWeight:600,cursor:"pointer",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onClick={()=>setTab("lifts")}>{s.exercise}</span>
                      <span style={{color:C.text,fontWeight:600,flexShrink:0,fontSize:14}}>{s.weight?`${s.sets}×${s.reps} @ ${s.weight}${s.unit}`:s.reps?`${s.sets}×${s.reps}`:`${s.sets} sets`}</span>
                      <DeleteBtn onDelete={()=>deleteWorkoutEntry(workout.timestamp)} style={{marginLeft:4}}/>
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
          <div style={card}>
            <div style={ctitle}>Today's Meals</div>
            {todayNut.length===0
              ?<div style={{fontSize:15,color:C.muted}}>No food logged yet.</div>
              :todayNut.map((entry,ei)=>(
                <div key={entry.timestamp||ei} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{fontSize:12,color:C.mutedLight,textTransform:"capitalize",fontWeight:600,letterSpacing:"0.04em"}}>{entry.meal}</div>
                    {entry.items.length>1&&<DeleteBtn onDelete={()=>deleteNutritionEntry(entry.timestamp)} style={{fontSize:11,padding:"2px 8px"}}/>}
                  </div>
                  {entry.items.map((item,ii)=>(
                    <div key={ii} style={{...rowSt,gap:10}}>
                      <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:15}}>{item.quantity} {item.name}</span>
                      <span style={{color:C.amber,fontWeight:700,flexShrink:0,fontSize:15}}>{item.calories} cal</span>
                      <button onClick={()=>setEditFoodModal({entryTimestamp:entry.timestamp,itemIndex:ii,item})} style={{background:"none",border:`1.5px solid ${C.border}`,borderRadius:8,padding:"4px 10px",color:C.mutedLight,fontSize:12,fontFamily:"inherit",cursor:"pointer",flexShrink:0,minHeight:32,whiteSpace:"nowrap"}}>✎</button>
                      <DeleteBtn onDelete={()=>deleteNutritionItem(entry.timestamp,ii)}/>
                    </div>
                  ))}
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tab==="lifts"&&<LiftsTab workouts={workouts} exerciseMap={exerciseMap} muscleOverrides={muscleOverrides} onDeleteWorkout={deleteWorkoutEntry} onDeleteSet={deleteWorkoutSet} weeklySets={weeklySets}/>}

      {tab==="foods"&&(
        <FoodsTab
          customFoods={customFoods}
          onDelete={name=>{const u={...customFoods};delete u[name.toLowerCase()];setCustomFoods(u);save(STORAGE_KEYS.customFoods,u);}}
          onEdit={food=>setEditCustomFoodModal(food)}
          onLog={(food,mult=1)=>{
            const entry={date:selectedDate,timestamp:Date.now(),meal:"snack",items:[{...food,calories:Math.round(food.calories*mult),protein_g:Math.round(food.protein_g*mult),carbs_g:Math.round(food.carbs_g*mult),fat_g:Math.round(food.fat_g*mult),quantity:food.servingUnit?`${Math.round(mult*(food.servingAmount||1))} ${food.servingUnit}`:`${mult} serving${mult!==1?"s":""}`}]};
            const u=[...nutrition,entry];setNutrition(u);save(STORAGE_KEYS.nutrition,u);
            setTab("chat");
            const logged={calories:Math.round(food.calories*mult),protein_g:Math.round(food.protein_g*mult),carbs_g:Math.round(food.carbs_g*mult),fat_g:Math.round(food.fat_g*mult)};
            setMessages(prev=>[...prev,{role:"assistant",content:`✅ ${food.name} logged!\n${logged.calories} cal | ${logged.protein_g}g protein | ${logged.carbs_g}g carbs | ${logged.fat_g}g fat`,type:"nutrition"}]);
          }}
        />
      )}

      {tab==="charts"&&(
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}><button onClick={()=>setWeekOffset(w=>w+1)} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",fontSize:16,cursor:"pointer"}}>←</button>{weekOffset>0?<button onClick={()=>setWeekOffset(0)} style={{background:C.accentLight,border:`1px solid ${C.accent}`,borderRadius:10,padding:"8px 14px",fontSize:13,color:C.accent,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>This Week</button>:<div style={{fontSize:13,color:C.muted,fontWeight:600}}>This Week</div>}<button onClick={()=>setWeekOffset(w=>Math.max(0,w-1))} style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",fontSize:16,cursor:"pointer",opacity:weekOffset===0?0.3:1}}>→</button></div>
          {[{title:"Calories — Last 7 Days",data:wkCal,dKey:"cal",name:"Calories",color:C.amber},{title:"Protein — Last 7 Days",data:wkPro,dKey:"protein",name:"Protein (g)",color:C.accent},{title:"Workout Volume — Last 7 Days",data:wkVol,dKey:"volume",name:"Volume (lbs)",color:C.green}].map(({title,data,dKey,name,color})=>(
            <div key={title} style={card}><div style={ctitle}>{title}</div>
              <ResponsiveContainer width="100%" height={160}><BarChart data={data} margin={{top:4,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="date" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:11}}/><Tooltip content={<CustomTooltip/>}/><Bar dataKey={dKey} name={name} fill={color} radius={[5,5,0,0]} opacity={0.85}/></BarChart></ResponsiveContainer>
            </div>
          ))}
          <div style={card}><div style={ctitle}>Bodyweight Trend</div>
            {bwChart.length<2?<div style={{fontSize:14,color:C.muted}}>Log bodyweight on 2+ days to see trend.</div>
              :<ResponsiveContainer width="100%" height={160}><LineChart data={bwChart} margin={{top:4,right:4,left:-20,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="date" tick={{fill:C.muted,fontSize:11}}/><YAxis tick={{fill:C.muted,fontSize:11}} domain={["auto","auto"]}/><Tooltip content={<CustomTooltip/>}/><Line type="monotone" dataKey="weight" name="Weight (lbs)" stroke={C.purple} strokeWidth={2.5} dot={{fill:C.purple,r:4}}/></LineChart></ResponsiveContainer>}
          </div>
        </div>
      )}

      {tab==="settings"&&(
        <div style={{flex:1,overflowY:"auto",padding:16}}>
          <div style={card}>
            <div style={ctitle}>Macro Goals</div>
            <div style={{marginBottom:16}}><label style={{fontSize:14,color:C.muted,fontWeight:600,display:"block",marginBottom:8}}>Daily Calories</label><input style={inp} type="number" value={draftCals} onChange={e=>setDraftCals(e.target.value)}/></div>
            <div style={{marginBottom:20}}><label style={{fontSize:14,color:C.muted,fontWeight:600,display:"block",marginBottom:8}}>Daily Protein (g)</label><input style={inp} type="number" value={draftPro} onChange={e=>setDraftPro(e.target.value)}/>{previewC>0&&<div style={{fontSize:13,color:C.mutedLight,marginTop:6}}>Protein = <span style={{color:C.accent,fontWeight:600}}>{proteinPct}%</span> of calories · {remainCals} cal left for carbs & fat</div>}</div>
            <div style={{marginBottom:20}}><label style={{fontSize:14,color:C.muted,fontWeight:600,display:"block",marginBottom:12}}>Remaining Calories Split</label><SplitBar carbPct={draftSplit} onChange={setDraftSplit}/></div>
            <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginBottom:16}}>
              {[["Calories",previewC,"cal",C.amber],["Protein",previewP,"g",C.accent],["Carbs",previewD.carbs_g,"g",C.purple],["Fat",previewD.fat_g,"g",C.orange]].map(([l,v,u,c])=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:15,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}><span style={{color:C.muted,fontWeight:500}}>{l}</span><span style={{color:c,fontWeight:700}}>{v}{u}</span></div>
              ))}
            </div>
            <button style={{background:savedFlash?C.green:C.accent,border:"none",borderRadius:12,padding:"14px 16px",color:"#fff",fontWeight:700,fontFamily:"inherit",fontSize:16,cursor:"pointer",width:"100%",transition:"background 0.3s"}} onClick={saveGoals}>{savedFlash?"✓ Saved!":"Save Goals"}</button>
          </div>
          <div style={card}>
            <div style={ctitle}>Data</div>
            <div style={{fontSize:14,color:C.muted,marginBottom:14}}>{workouts.length} sessions · {nutrition.length} meals · {bodyweight.length} weigh-ins · {Object.keys(customFoods).length} custom foods</div>
            <button style={{background:C.redLight,border:`1.5px solid ${C.red}`,borderRadius:12,padding:"13px 16px",color:C.red,fontWeight:700,fontFamily:"inherit",fontSize:15,cursor:"pointer",width:"100%"}} onClick={()=>{if(confirm("Delete ALL data? This cannot be undone.")){setWorkouts([]);setNutrition([]);setBW([]);setTemplates({});setExerciseMap({});setCustomFoods({});Object.values(STORAGE_KEYS).forEach(k=>localStorage.removeItem(k));scheduleBinSync();}}}>Clear All Data</button>
          </div>
        </div>
      )}
    <div style={{display:"flex",background:C.surface,borderTop:`1px solid ${C.border}`,flexShrink:0,boxShadow:"0 -1px 3px rgba(0,0,0,0.06)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        {[["chat","Chat"],["dashboard","Today"],["lifts","Lifts"],["foods","Foods"],["charts","Charts"],["settings","⚙"]].map(([id,label])=>(
          <button key={id} style={tabSt(tab===id)} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>
    </div>
  );
}
