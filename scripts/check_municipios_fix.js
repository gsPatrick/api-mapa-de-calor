const http = require('http');

http.get('http://localhost:3001/api/municipios', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log(`Status Code: ${res.statusCode}`);
        if (res.statusCode === 200) {
            console.log('Response Preview:', data.substring(0, 100));
        } else {
            console.log('Response Error:', data);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
