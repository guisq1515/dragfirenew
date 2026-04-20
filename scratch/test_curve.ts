import { curveService } from '../src/services/CurveAnalysisService';

const nodes = [
  { lat: 0, lng: 0 },
  { lat: 0.001, lng: 0 },
  { lat: 0.002, lng: 0 }, // Goes North 
  { lat: 0.002, lng: 0.001 }, // Turns East (Right turn 90 deg)
  { lat: 0.002, lng: 0.002 }, 
  { lat: 0.002, lng: 0.003 }
];

console.log(curveService.findNextCurve(0, 0, 0, nodes, 1000));
