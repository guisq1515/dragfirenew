
import fs from 'fs';
import path from 'path';

// Simplified Curve detection for the backend script
// This mimics the frontend CurveAnalysisService logic but runs in Node.js
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findUpcomingCurves(nodes: { lat: number, lng: number }[], lookAheadMeters: number): any[] {
  if (nodes.length < 5) return [];
  const found: any[] = [];
  
  let i = 0, scan = 0;
  while (i < nodes.length - 3) {
    scan += haversineDistance(nodes[i].lat, nodes[i].lng, nodes[i+1].lat, nodes[i+1].lng);
    if (scan > lookAheadMeters) break;

    let cumAngle = 0, win = 0, j = i;
    let signChanges = 0, lastAngle = 0;
    
    while (j < nodes.length - 2 && win < 150) {
      win += haversineDistance(nodes[j].lat, nodes[j].lng, nodes[j+1].lat, nodes[j+1].lng);
      const v1 = { x: nodes[j+1].lng - nodes[j].lng, y: nodes[j+1].lat - nodes[j].lat };
      const v2 = { x: nodes[j+2].lng - nodes[j+1].lng, y: nodes[j+2].lat - nodes[j+1].lat };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y), mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      if (mag1 > 0 && mag2 > 0) {
         const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
         const currentSign = (v1.x * v2.y - v1.y * v2.x) < 0 ? 1 : -1;
         const signedAngle = currentSign * angle;
         
         if (lastAngle !== 0 && Math.sign(signedAngle) !== Math.sign(lastAngle) && Math.abs(signedAngle) > 5) {
            signChanges++;
         }
         
         cumAngle += signedAngle;
         lastAngle = signedAngle;
      }
      j++;
    }

    if (Math.abs(cumAngle) > 15 || signChanges >= 2) {
      let type = 'soft';
      const absAngle = Math.abs(cumAngle);
      if (signChanges >= 2) type = 'chicane';
      else if (absAngle > 140) type = 'hairpin';
      else if (absAngle > 90) type = 'hard';
      else if (absAngle > 45) type = 'medium';
      else if (absAngle < 10) type = 'straight';

      found.push({
        a: Math.round(absAngle),
        s: type,
        d: 0,
        p: Math.round(scan),
        di: cumAngle > 0 ? 'right' : 'left',
        sl: 0,
        u: false,
        n: nodes.slice(i, j + 1).map((_, idx) => i + idx) // Store relative indices
      });
      i = j;
    } else {
      i++;
    }
  }
  return found;
}

async function generatePackage() {
  // Bounding box for Interior SP (Ribeirão Preto, Franca, Jardinópolis, Brodowski)
  // [south, west, north, east]
  const bbox = "-21.5,-48.0,-20.5,-47.0";
  const name = "sp_interior";
  
  console.log(`Buscando dados da Overpass API para a região: ${name}...`);
  
  const overpassQuery = `
    [out:json][timeout:300];
    (
      way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified"](${bbox});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, {
      method: 'GET',
      headers: { 
        'Accept': '*/*',
        'User-Agent': 'DragFireApp/1.0 (contact@dragfire.com)'
      }
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Erro da Overpass API:", text);
      return;
    }
    if (!data.elements) {
      console.error("Nenhum dado retornado.");
      return;
    }

    const nodesMap: Record<number, { lat: number, lng: number }> = {};
    const ways: any[] = [];

    console.log("Processando nós...");
    data.elements.forEach((el: any) => {
      if (el.type === 'node') {
        nodesMap[el.id] = { lat: el.lat, lng: el.lon };
      }
    });

    console.log("Processando vias e calculando curvas...");
    data.elements.forEach((el: any) => {
      if (el.type === 'way') {
        const points = el.nodes.map((id: number) => nodesMap[id]).filter(Boolean);
        const curves = findUpcomingCurves(points, 25000); // Calculate curves for the whole way
        
        // Map relative curve point indices back to absolute node IDs
        const finalCurves = curves.map(c => ({
          ...c,
          n: c.n.map((idx: number) => el.nodes[idx])
        }));

        ways.push({
          i: el.id,
          n: el.nodes,
          t: el.tags,
          c: finalCurves
        });
      }
    });

    const region = {
      id: name,
      la: -21.0, // Center approx
      ln: -47.5,
      r: 100000, // Very large radius so it doesn't expire quickly
      t: Date.now(),
      w: ways,
      n: nodesMap
    };

    const outPath = path.resolve(process.cwd(), `public/maps/${name}_pack.json`);
    
    // Create directory if it doesn't exist
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`Salvando pacote em ${outPath}...`);
    fs.writeFileSync(outPath, JSON.stringify(region));
    
    const stats = fs.statSync(outPath);
    console.log(`Pacote '${name}' gerado com sucesso! Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error("Erro ao gerar o pacote:", error);
  }
}

generatePackage();
