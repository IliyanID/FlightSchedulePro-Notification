import dayjs from 'dayjs';
import { z } from 'zod';

const DayjsSchema = z.coerce.date()                // accepts string|number|Date → Date
.transform((d) => dayjs(d))

// --- Resource type ---
export const ResourceSchema = z.object({
  Id: z.string(),
  Name: z.string(),
  ResourceTypeId: z.number(),
  AircraftMake: z.string().or(z.null()),
});
export type IResource = z.infer<typeof ResourceSchema>;

// --- Event type ---
export const EventSchema = z.object({
  ResourceId: z.string(),
  StartAtUtc: DayjsSchema,
  EndAtUtc: DayjsSchema,
  InstructorId: z.string().or(z.null()).default(null)
});
export type IEvent = z.infer<typeof EventSchema>;

// --- Unavailability type ---
export const UnavailabilitySchema = z.object({
  ResourceId: z.string(),
  StartDate: DayjsSchema,
  EndDate: DayjsSchema,
});
export type IUnavailability = z.infer<typeof UnavailabilitySchema>;

// --- Results container ---
export const ResultsSchema = z.object({
  resources: z.array(ResourceSchema),
  events: z.array(EventSchema),
  unavailability: z.array(UnavailabilitySchema),
});
export type IResults = z.infer<typeof ResultsSchema>;

// --- Top-level response ---
export const ApiResponseSchema = z.object({
  results: ResultsSchema,
});
export type IApiResponse = z.infer<typeof ApiResponseSchema>;
