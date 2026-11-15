import type {Command, Envelope} from './model';

// Only preview the checkmark. Rewards and recurring dates remain server-confirmed.
export function previewTaskCheck(data: Envelope, command: Command): Envelope | undefined {
    if (command.type !== 'task.toggle') return;
    const task = data.state.tasks.find(t => t.id === command.id && !t.deletedAt);
    if (!task || task.done === command.done) return;
    return {...data, state: {...data.state, tasks: data.state.tasks.map(t =>
        t.id === task.id ? {...t, done: !!command.done} : t)}};
}

/**
 * Save cues are split so a completion is only heard after the planner has
 * accepted the change. A plain selection click may sound immediately.
 */
export function saveCueAtIntent(command:{type:string;done?:boolean}){return command.type==='task.toggle'&&command.done?null:'selection' as const}
export function saveCueAfterSave(command:{type:string;done?:boolean},levelUp=false){if(!(command.type==='task.toggle'&&command.done))return null;return levelUp?'level' as const:'complete' as const}
