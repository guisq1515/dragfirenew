const http = require('https');
const lat = -23.515; 
const lng = -46.611;
const query = `[out:json][timeout:25];\n(\nway["highway"](around:500,${lat},${lng});\n);\nout body;\n>;\nout skel qt;`;

const req = http.request('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' }
}, res => {
  let chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    const data = JSON.parse(Buffer.concat(chunks).toString());
    const nodesMap = {};
    const ways = [];
    data.elements.forEach(el => {
      if (el.type === 'node') nodesMap[el.id] = { lat: el.lat, lng: el.lon };
      else if (el.type === 'way') ways.push(el);
    });
    console.log(`Found ${ways.length} ways`);
    if (ways.length > 0) {
      console.log('Way 0 name:', ways[0].tags?.name);
      console.log('Way 0 nodes count:', ways[0].nodes.length);
    }
  });
});
req.write(query);
req.end();
