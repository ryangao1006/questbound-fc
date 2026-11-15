/** Activated only after the owner migration and independent recovery checks pass. */
export function legacyReadOnly(config:{PLANNER_READ_ONLY?:string}){return config.PLANNER_READ_ONLY==='1'}
export const CUTOVER_MESSAGE='This original planner is read-only after migration. Your records are preserved; continue in the Microsoft / OneDrive entry.';
