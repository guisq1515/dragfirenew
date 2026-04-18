
const addresses = [
  "R. Américo Sáles, 371 - Centro, Jardinópolis - SP",
  "Av. Paulista, 1000, São Paulo - SP",
  "R. Teste, 123, Jardinópolis - SP",
  "Rua Carlos Gomes, 123 - Centro, Ribeirão Preto - SP",
  "Av. Brasil, S/N, Rio de Janeiro - RJ"
];

const regex = /,\s*([^,]+)\s*-\s*[A-Z]{2}$/;

addresses.forEach(addr => {
  const match = addr.match(regex);
  console.log(`Address: ${addr}`);
  console.log(`Match: ${match ? match[1].trim() : 'NONE'}`);
  console.log('---');
});
