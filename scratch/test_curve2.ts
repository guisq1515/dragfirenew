function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateAngle(p1: any, p2: any, p3: any): number {
    const v1 = { x: p2.lng - p1.lng, y: p2.lat - p1.lat };
    const v2 = { x: p3.lng - p2.lng, y: p3.lat - p2.lat };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosTheta = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
    
    const cross = v1.x * v2.y - v1.y * v2.x;
    return cross < 0 ? angle : -angle;
}

function findNextCurve(currentLat: number, currentLng: number, currentHeading: number, nodes: any[], lookAheadMeters: number) {
    if (nodes.length < 5) return null;

    let closestIdx = 0;
    let minDist = Infinity;
    nodes.forEach((node, idx) => {
      const d = haversineDistance(currentLat, currentLng, node.lat, node.lng);
      if (d < minDist) {
        minDist = d;
        closestIdx = idx;
      }
    });

    const WINDOW_METERS = 60;
    let distanceToScanStart = 0;

    for (let i = closestIdx; i < nodes.length - 3; i++) {
      const d = haversineDistance(nodes[i].lat, nodes[i].lng, nodes[i+1].lat, nodes[i+1].lng);
      distanceToScanStart += d;
      
      if (distanceToScanStart > lookAheadMeters) break;

      let cumulativeAngle = 0;
      let windowDist = 0;
      let j = i;

      while (j < nodes.length - 2 && windowDist < WINDOW_METERS) {
        const stepDist = haversineDistance(nodes[j].lat, nodes[j].lng, nodes[j+1].lat, nodes[j+1].lng);
        windowDist += stepDist;
        
        const angle = calculateAngle(nodes[j], nodes[j+1], nodes[j+2]);
        cumulativeAngle += angle;
        j++;
      }

      if (Math.abs(cumulativeAngle) > 25) {
        return {
          angle: Math.round(Math.abs(cumulativeAngle)),
          distance: Math.round(distanceToScanStart),
          direction: cumulativeAngle > 0 ? 'right' : 'left'
        };
      }
    }
    return null;
}

// 90 degree sharp left turn
const nodes = [
  { lat: -23.0010, lng: -46.0010 }, 
  { lat: -23.0011, lng: -46.0010 }, 
  { lat: -23.0012, lng: -46.0010 }, 
  { lat: -23.0013, lng: -46.0010 }, // approaches turn heading south
  { lat: -23.0013, lng: -46.0009 }, // turns east
  { lat: -23.0013, lng: -46.0008 },
  { lat: -23.0013, lng: -46.0007 }
];

console.log(findNextCurve(-23.0009, -46.0010, 180, nodes, 1000));
