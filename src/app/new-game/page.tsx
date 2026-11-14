"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, Flag, Shield, Sparkles, Save } from "lucide-react";
import { ClubCrest } from "@/components/ui/ClubCrest";
import { listStarterClubs, createStarterWorld, nextSaturday } from "@/engines/world/newSave";
import { createNewSave } from "@/engines/persistence/saveManager";
import { useGameStore } from "@/state/gameStore";

const STEPS = [
  { label: "Club", title: "Choose your club", description: "Find the team you want to lead." },
  { label: "World", title: "Set up your world", description: "Choose when your story begins and review the competitions in your database." },
  { label: "Manager", title: "Build your manager", description: "Give your manager a name, nationality and coaching identity." },
  { label: "Review", title: "Ready for the touchline?", description: "Check your choices before the football begins." },
] as const;
const NATIONALITIES = [["ENG","England"],["SCO","Scotland"],["WAL","Wales"],["NIR","Northern Ireland"],["IRL","Republic of Ireland"],["NGA","Nigeria"],["GHA","Ghana"],["SEN","Senegal"],["FRA","France"],["GER","Germany"],["ESP","Spain"],["ITA","Italy"],["POR","Portugal"],["NED","Netherlands"],["BEL","Belgium"],["BRA","Brazil"],["ARG","Argentina"],["USA","United States"],["JPN","Japan"],["KOR","South Korea"]] as const;
const REPUTATIONS = [
  {value:25,title:"Emerging",detail:"A new name looking for a first big break."},
  {value:40,title:"Established",detail:"A credible coach with a growing reputation."},
  {value:70,title:"Elite",detail:"A proven manager arriving with high expectations."},
] as const;
const FORMATIONS = ["4-3-3","4-2-3-1","4-4-2","3-5-2","4-1-4-1","3-4-3","5-3-2"];

export default function NewGamePage() {
  const router=useRouter();
  const loadSave=useGameStore(s=>s.loadSave);
  const allClubs=useMemo(()=>listStarterClubs(),[]);
  const leagues=useMemo(()=>Array.from(new Set(allClubs.map(c=>c.leagueName))).map(name=>({name,count:allClubs.filter(c=>c.leagueName===name).length})),[allClubs]);
  const [step,setStep]=useState(0);
  const [selectedLeague,setSelectedLeague]=useState("");
  const [selectedClubId,setSelectedClubId]=useState("");
  const [startDate,setStartDate]=useState(nextSaturday(new Date().toISOString().slice(0,10)));
  const [saveName,setSaveName]=useState("");
  const [managerFirstName,setManagerFirstName]=useState("");
  const [managerLastName,setManagerLastName]=useState("");
  const [managerNationality,setManagerNationality]=useState("ENG");
  const [managerReputation,setManagerReputation]=useState(40);
  const [managerFormation,setManagerFormation]=useState("4-3-3");
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{if(!selectedLeague&&leagues[0])setSelectedLeague(leagues[0].name);},[leagues,selectedLeague]);
  const clubsInLeague=selectedLeague?allClubs.filter(c=>c.leagueName===selectedLeague):[];
  const selectedClub=allClubs.find(c=>c.id===selectedClubId);
  const currentStep=STEPS[step]??STEPS[0];
  const managerName=(managerFirstName.trim()+" "+managerLastName.trim()).trim();
  const finalSaveName=saveName.trim()||(managerName&&selectedClub?managerName+" — "+selectedClub.name:"Untitled career");
  const valid=[!!selectedClubId&&!!selectedClub,!!startDate,!!managerFirstName.trim()&&!!managerLastName.trim(),!!selectedClub&&!!managerName&&!!startDate];
  function changeLeague(name:string){setSelectedLeague(name);if(selectedClub&&selectedClub.leagueName!==name)setSelectedClubId("");}
  function nextStep(){if(!valid[step])return;setError("");setStep(v=>Math.min(v+1,STEPS.length-1));}
  function previousStep(){setError("");setStep(v=>Math.max(v-1,0));}
  async function handleStart(){
    if(!selectedClub||!valid[3])return;
    setCreating(true);setError("");
    try{
      const world=createStarterWorld({managerFirstName:managerFirstName.trim(),managerLastName:managerLastName.trim(),managerNationality,managerReputation,managerFormation,userClubId:selectedClub.id,startDate});
      const meta=await createNewSave({name:finalSaveName,managerName,clubName:selectedClub.name,startDate:world.currentDate,world});
      loadSave(meta,{...world,saveId:meta.id});router.replace("/home");
    }catch(err){setError(err instanceof Error?err.message:"Touchline couldn't create this career.");setCreating(false);}
  }

  return (
    <div className="career-creator">
      <header className="career-creator-header">
        <Link href="/" className="launcher-brand"><span className="launcher-mark">T</span><span>TOUCHLINE</span></Link>
        <span className="career-creator-mode">NEW CAREER <span>·</span> SETUP</span>
        <Link href="/" className="career-creator-exit">Exit setup</Link>
      </header>
      <div className="career-creator-progress">
        <div className="career-creator-progress-copy"><span>CAREER SETUP</span><strong>STEP 0{step+1} <i>/ 04</i></strong></div>
        <div className="career-creator-progress-track"><span style={{width:((step+1)/STEPS.length*100)+"%"}}/></div>
        <div className="career-creator-step-labels">
          {STEPS.map((item,index)=><button key={item.label} type="button" onClick={()=>index<step&&setStep(index)} className={index===step?"career-step-active":index<step?"career-step-complete":""}>{index<step?<Check size={12}/>:<span>0{index+1}</span>}{item.label}</button>)}
        </div>
      </div>
      <main className="career-creator-main">
        <div className="career-creator-heading">
          <p className="launcher-kicker"><Sparkles size={13}/> YOUR NEXT CHAPTER</p>
          <h1>{currentStep.title}</h1><p>{currentStep.description}</p>
        </div>
        {error&&<div className="launcher-error" role="alert">{error}</div>}
        {step===0&&(
          <section className="career-panel">
            <div className="career-panel-heading"><div><span className="career-panel-index">01 / CLUB</span><h2>Choose a competition</h2></div><span className="career-panel-note">{allClubs.length} playable clubs</span></div>
            <div className="career-league-picker">{leagues.map(l=><button type="button" key={l.name} onClick={()=>changeLeague(l.name)} className={selectedLeague===l.name?"career-league-active":""}><span>{l.name}</span><small>{l.count} clubs</small></button>)}</div>
            <div className="career-panel-heading career-club-heading"><div><span className="career-panel-index">02 / TEAM</span><h2>Select your team</h2></div><span className="career-panel-note">{selectedLeague||"Choose a competition"}</span></div>
            <div className="career-club-grid">{clubsInLeague.map(c=><button type="button" key={c.id} onClick={()=>setSelectedClubId(c.id)} className={selectedClubId===c.id?"career-club-card career-club-selected":"career-club-card"}><ClubCrest clubId={c.id} abbreviation={c.abbreviation} color={c.color} size={40}/><span>{c.name}</span>{selectedClubId===c.id&&<i><Check size={13}/></i>}</button>)}</div>
            {selectedClub&&<div className="career-selected-club"><ClubCrest clubId={selectedClub.id} abbreviation={selectedClub.abbreviation} color={selectedClub.color} size={48}/><div><small>YOUR APPOINTMENT</small><strong>{selectedClub.name}</strong><span>{selectedClub.leagueName}</span></div><Shield size={21}/></div>}
          </section>
        )}
        {step===1&&(
          <section className="career-panel">
            <div className="career-panel-heading"><div><span className="career-panel-index">01 / DATABASE</span><h2>Your football world</h2></div><span className="career-panel-note">Touchline database</span></div>
            <p className="career-help-copy">Your career loads the playable competitions currently included in Touchline. They run together in one connected football world.</p>
            <div className="career-world-grid">{leagues.map((l,i)=><div className="career-world-card" key={l.name}><span className="career-world-number">0{i+1}</span><div><strong>{l.name}</strong><small>{l.count} clubs · England</small></div><Check size={17}/></div>)}</div>
            <div className="career-setting-grid">
              <label className="career-field"><span><CalendarDays size={15}/> Season starting date</span><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/><small>The calendar and first set of fixtures start from this date.</small></label>
              <label className="career-field"><span><Save size={15}/> Career save name</span><input type="text" value={saveName} onChange={e=>setSaveName(e.target.value)} placeholder={managerName&&selectedClub?managerName+" — "+selectedClub.name:"Give this career a name"}/><small>You can recognise and load this career from your library later.</small></label>
            </div>
          </section>
        )}
        {step===2&&(
          <section className="career-panel">
            <div className="career-panel-heading"><div><span className="career-panel-index">01 / IDENTITY</span><h2>Manager profile</h2></div><span className="career-panel-note">Your name in the dugout</span></div>
            <div className="career-manager-fields">
              <label className="career-field"><span>First name</span><input value={managerFirstName} onChange={e=>setManagerFirstName(e.target.value)} placeholder="e.g. Alex" autoComplete="given-name"/></label>
              <label className="career-field"><span>Last name</span><input value={managerLastName} onChange={e=>setManagerLastName(e.target.value)} placeholder="e.g. Morgan" autoComplete="family-name"/></label>
              <label className="career-field career-nationality-field"><span><Flag size={14}/> Nationality</span><select value={managerNationality} onChange={e=>setManagerNationality(e.target.value)}>{NATIONALITIES.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select><ChevronDown size={14}/></label>
            </div>
            <div className="career-subsection-heading"><span className="career-panel-index">02 / REPUTATION</span><h3>Where are you starting from?</h3></div>
            <div className="career-reputation-grid">{REPUTATIONS.map(o=><button type="button" key={o.value} onClick={()=>setManagerReputation(o.value)} className={managerReputation===o.value?"career-reputation-option career-reputation-active":"career-reputation-option"}><strong>{o.title}</strong><span>{o.detail}</span><small>{o.value} reputation</small></button>)}</div>
            <div className="career-subsection-heading"><span className="career-panel-index">03 / COACHING IDENTITY</span><h3>Preferred formation</h3></div>
            <div className="career-formation-picker">{FORMATIONS.map(f=><button type="button" key={f} onClick={()=>setManagerFormation(f)} className={managerFormation===f?"career-formation-active":""}>{f}</button>)}</div>
            <p className="career-help-copy">Your preferred shape becomes the starting tactic and manager profile preference. You can change tactics once your career begins.</p>
          </section>
        )}
        {step===3&&selectedClub&&(
          <section className="career-review">
            <div className="career-review-club"><ClubCrest clubId={selectedClub.id} abbreviation={selectedClub.abbreviation} color={selectedClub.color} size={64}/><div><span className="career-panel-index">THE CLUB</span><h2>{selectedClub.name}</h2><p>{selectedClub.leagueName}</p></div></div>
            <div className="career-review-grid">
              <div><span>MANAGER</span><strong>{managerName}</strong><small>{NATIONALITIES.find(([code])=>code===managerNationality)?.[1]??managerNationality}</small></div>
              <div><span>REPUTATION</span><strong>{REPUTATIONS.find(o=>o.value===managerReputation)?.title}</strong><small>{managerReputation} starting reputation</small></div>
              <div><span>TACTICAL IDENTITY</span><strong>{managerFormation}</strong><small>Preferred formation</small></div>
              <div><span>WORLD START</span><strong>{new Date(startDate+"T00:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</strong><small>{leagues.length} competitions · {allClubs.length} clubs</small></div>
            </div>
            <div className="career-review-save"><Save size={17}/><div><small>CAREER FILE</small><strong>{finalSaveName}</strong></div></div>
            <p className="career-help-copy">Your world will be generated locally on this device. Your saved career will appear on the Touchline start screen.</p>
          </section>
        )}
      </main>
      <footer className="career-creator-footer">
        <button type="button" onClick={previousStep} disabled={step===0||creating} className="career-back-button"><ArrowLeft size={16}/> Back</button>
        <div className="career-footer-context"><span>TOUCHLINE</span><small>Step {step+1} of 4</small></div>
        {step<STEPS.length-1?<button type="button" onClick={nextStep} disabled={!valid[step]||creating} className="career-next-button">Continue <ArrowRight size={17}/></button>
          :<button type="button" onClick={handleStart} disabled={!valid[3]||creating} className="career-next-button">{creating?"Building your world…":"Create career"} <ArrowRight size={17}/></button>}
      </footer>
    </div>
  );
}
