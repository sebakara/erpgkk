import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  isEngineeringDepartment,
  isEngineeringHeadTitle,
  pickEngineeringDepartment,
} from '../src/common/access/engineering';

test('engineering access matchers', () => {
  assert.equal(isEngineeringDepartment('R&D Department'), true);
  assert.equal(isEngineeringDepartment('Engineering'), true);
  assert.equal(isEngineeringDepartment('Marketing & Sales'), false);
  assert.equal(isEngineeringHeadTitle('Head of Engineering'), true);
  assert.equal(isEngineeringHeadTitle('Software Engineer'), false);
  assert.equal(isEngineeringHeadTitle('Product Manager'), false);

  const picked = pickEngineeringDepartment([
    { id: 'eng', name: 'Engineering' },
    { id: 'rnd', name: 'R&D Department' },
  ]);
  assert.equal(picked?.id, 'rnd');
});
