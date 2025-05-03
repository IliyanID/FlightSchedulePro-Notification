import dayjs, { Dayjs } from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter  from "dayjs/plugin/isSameOrAfter";
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

import { findInstructor, findPlaneResource } from "./findResource";
import { IApiResponse, IEvent } from "./schemas";

type Slot = { start: Dayjs; end: Dayjs, resourceId?: string };

export type FindOverlapsProps = {
  data: IApiResponse;
  minDurHours: number;
  startHour: number;
  endHour: number;
  start: Dayjs,
  end: Dayjs
};

export const findOverlaps = (p: FindOverlapsProps): string[] => {
  const { resources, events, unavailability } = p.data.results;

  const instructor = findInstructor(resources);


  const planes = findPlaneResource(resources);
  //Sort from soonest to latest


  const eventsByPlane:Record<string, IEvent[]> = {}
  planes.forEach(p=>{
    eventsByPlane[p.Id] = []
  })
  events.forEach(e => {
    if(eventsByPlane[e.ResourceId] !== undefined){
      eventsByPlane[e.ResourceId].push(e)
    }
  })



  const days = Math.abs(p.start.diff(p.end, "days")) - 1;

  const slotsToAlertOn:Slot[] = []

  for (let i = 0; i <= days; i++) {
    const base = p.start.add(i, "days").tz("America/Denver");
    const start = base.startOf("day").add(p.startHour, "hour");
    const end   = base.startOf("day").add(p.endHour,   "hour");

  const instructorUnavailability = unavailability.filter(u=>u.ResourceId === instructor.Id && u.StartDate.isSameOrAfter(start))
    console.log(`Start ${start.tz("America/Denver").format('DD HH:mm:ss')}`)
    
    const instructorSlots = findSlots(start,end,events.filter(e=>e.InstructorId === instructor.Id).map(e=>({start: e.StartAtUtc, end: e.EndAtUtc})))

    if(instructorSlots.length === 0) continue;

    Object.keys(eventsByPlane).forEach(plane=>{
      const events = eventsByPlane[plane];
      
      const res = findSlots(start,end,events.map(e=>({start: e.StartAtUtc, end: e.EndAtUtc})),p.minDurHours);


      res.forEach(planeSlot =>{
        const instructorFree = instructorSlots.some (instructorSlot=>{
          return instructorSlot.start.isSameOrBefore(planeSlot.start) && instructorSlot.end.isSameOrAfter(planeSlot.end)
        })
        const instructorHasntBlockedOff = instructorUnavailability.some(r =>
          planeSlot.start.isBefore(r.EndDate) &&
          planeSlot.end.isAfter(r.StartDate)
        );
        if(instructorFree && instructorHasntBlockedOff){
          slotsToAlertOn.push({...planeSlot, resourceId: plane})
        }

      })
    })
  }


  return slotsToAlertOn.map(result=>{
    const plane = planes.find(p=>p.Id === result.resourceId);
    const hrs = Math.abs(
      result.start.diff(result.end, 'hours', true)
    );
    const res = 
      `✈️ ${plane?.Name} & 👩‍✈️ ${instructor.Name} free: ` +
      `${result.start.tz('America/Denver').format("YYYY-MM-DD hh:mm A")} → ` +
      `${result.end.tz('America/Denver').format("YYYY-MM-DD hh:mm A")} ` +
      `(${hrs.toFixed(2)}h)`
    console.log(res)
    return res;
  })
};

const findSlots = (
  start: Dayjs,
  end: Dayjs,
  rawEvents: Slot[],
  minDurHours = 0
): Slot[] => {
  const res: Slot[] = [];
  let cur = start;

  const events = rawEvents
    .filter(e => e.end.isAfter(start) && e.start.isBefore(end))
    .sort((a, b) => a.start.valueOf() - b.start.valueOf());

  for (const ev of events) {
    if (cur.isBefore(start)) cur = start;

    if (ev.start.isAfter(cur)) {
      const dur = ev.start.diff(cur, 'hours', true);
      if (dur >= minDurHours) {
        res.push({ start: cur, end: ev.start });
      }
      cur = ev.end;            
    }

    if (ev.end.isAfter(cur)) {
      cur = ev.end;
    }
  }

  if (end.isAfter(cur)) {
    const dur = end.diff(cur, 'hours', true);
    if (dur >= minDurHours) {
      res.push({ start: cur, end });
    }
  }

  return res;
};
