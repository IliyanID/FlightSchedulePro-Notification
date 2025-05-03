import { IResource } from "./schemas";

export const findPlaneResource = (resources: IResource[]):IResource[] =>{
    return resources.filter(r => r.AircraftMake === 'Cessna')
}

export const findInstructor = (resources: IResource[]):IResource => {
    const instructor = resources.find(r => r.Name === 'Jonathon Richards (CFI)')
    if(!instructor) throw new Error('Failed to find instructor')
    return instructor;
}