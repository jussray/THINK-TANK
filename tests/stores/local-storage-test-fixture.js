'use strict';

async function seedCorruptIdeaRecord(page) {
  await page.evaluate(() => {
    localStorage.setItem('think-tank.idea-record.v0', '{not-json');
  });
}

module.exports = { seedCorruptIdeaRecord };
