import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
} from '@angular-devkit/architect';
import type { RunCommandArguments } from '@wdio/cli'

import { Observable } from 'rxjs';

export default createBuilder<any>(runWebdriverIO);

function runWebdriverIO(
    options: RunCommandArguments,
    context: BuilderContext
): Observable<BuilderOutput> {
    console.log(options, context)
    return null as any
}
