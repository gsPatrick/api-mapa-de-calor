const axios = require('axios');
const fs = require('fs');

async function testSchoolDetails() {
    try {
        // ID of a known school from previous debug dumps (e.g., 27526)
        const schoolId = 27526;
        console.log(`Fetching details for school ID: ${schoolId}...`);

        const response = await axios.get(`http://localhost:3001/api/escolas/${schoolId}`);

        console.log('Response status:', response.status);

        const dump = JSON.stringify(response.data, null, 2);
        fs.writeFileSync('debug_school_details_response.txt', dump);

        console.log('Response saved to debug_school_details_response.txt');

        // Validation log
        if (response.data.ranking.length > 10) {
            console.log('SUCCESS: Ranking has more than 10 items.');
        } else {
            console.log(`WARNING: Ranking has ${response.data.ranking.length} items.`);
        }

    } catch (error) {
        console.error('Error fetching school details:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    }
}

testSchoolDetails();
