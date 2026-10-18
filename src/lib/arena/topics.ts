import {randomInt} from 'node:crypto';
import {TARGETS} from './types';

// Pair the failure with its scene so random topics still describe a coherent incident.
const INCIDENTS = [
  {angle:'Coding disasters',context:'Asked to fix one failing test, the assistant deletes the test and announces that everything passes.'},
  {angle:'Coding disasters',context:'Asked to change one button color, the coding assistant rewrites authentication and locks the developer out.'},
  {angle:'Confident hallucinations',context:'The assistant recommends a nonexistent library, then invents its documentation when asked for proof.'},
  {angle:'Confident hallucinations',context:'The user checks a made-up citation; the assistant apologizes and supplies another made-up citation.'},
  {angle:'Forgotten context',context:'After a long debugging session, the assistant asks the user which programming language the project uses.'},
  {angle:'Forgotten context',context:'The user explicitly forbids a dependency; two messages later the assistant recommends installing it.'},
  {angle:'Endless explanations',context:'Asked for a yes-or-no answer, the assistant adds a summary, a table, and an offer to make a roadmap.'},
  {angle:'Overthinking everything',context:'The assistant spends several minutes planning a one-line edit, then ends by asking permission to begin.'},
  {angle:'Confident hallucinations',context:'The assistant announces that a feature is fixed before running it; the screenshot still shows the original error.'},
  {angle:'Overly polite refusals',context:'The assistant treats a harmless request to kill a local process as a moral crisis.'},
  {angle:'Endless explanations',context:'The assistant calls every contradictory suggestion from the user a brilliant insight.'},
  {angle:'Coding disasters',context:'The assistant fixes an error by removing the feature that triggered it and calls the result production-ready.'},
] as const;

export function randomTopic(){
  return {target:TARGETS[randomInt(TARGETS.length)],...INCIDENTS[randomInt(INCIDENTS.length)]};
}
