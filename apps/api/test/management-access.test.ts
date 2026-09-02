import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  isManagementDepartment,
  pickManagementDepartment,
} from '../src/common/access/management';

test('management department matchers', () => {
  assert.equal(isManagementDepartment('Management'), true);
  assert.equal(isManagementDepartment('Administration'), true);
  assert.equal(isManagementDepartment('Management Department'), true);
  assert.equal(isManagementDepartment('R&D Department'), false);
  assert.equal(isManagementDepartment('Project Management Office'), false);

  const picked = pickManagementDepartment([
    { id: 'admin', name: 'Administration' },
    { id: 'mgmt', name: 'Management' },
    { id: 'rnd', name: 'R&D Department' },
  ]);
  assert.equal(picked?.id, 'mgmt');

  const adminOnly = pickManagementDepartment([
    { id: 'admin', name: 'Administration' },
    { id: 'rnd', name: 'R&D Department' },
  ]);
  assert.equal(adminOnly?.id, 'admin');
});
