const islandSurfaceIndex = new Map();
const islandCoastIndex = new Map();
const islandSurfacePoint = new THREE.Vector3();
const islandMorphPoint = new THREE.Vector3();
const islandMorphBaseVec = new THREE.Vector3();
const ISLAND_SURFACE_CELL = 3.0; // Tamanho da célula da grade espacial

// 1. Constrói o índice espacial baseado na geometria atual e morphs da ilha
function rebuildIslandSurfaceIndex() {
  islandSurfaceIndex.clear();
  islandCoastIndex.clear();
  if (!importedIslandSegments || !importedIslandSegments.length) return;
  
  importedIslandGroup.updateMatrixWorld(true);
  
  for (const segment of importedIslandSegments) {
    const position = segment.mesh.geometry?.attributes?.position;
    if (!position) continue;
    
    const morphPositions = segment.mesh.geometry?.morphAttributes?.position ?? [];
    const morphInfluences = segment.mesh.morphTargetInfluences ?? [];
    const morphsRelative = segment.mesh.geometry?.morphTargetsRelative === true;
    
    segment.mesh.updateMatrixWorld(true);
    
    for (let i = 0; i < position.count; i++) {
      islandSurfacePoint.fromBufferAttribute(position, i);
      
      for (let morphIndex = 0; morphIndex < morphPositions.length; morphIndex++) {
        const influence = morphInfluences[morphIndex] ?? 0;
        if (Math.abs(influence) < 1e-5) continue;
        
        islandMorphPoint.fromBufferAttribute(morphPositions[morphIndex], i);
        
        if (morphsRelative) {
          islandSurfacePoint.addScaledVector(islandMorphPoint, influence);
        } else {
          islandMorphBaseVec.fromBufferAttribute(position, i);
          islandMorphPoint.sub(islandMorphBaseVec);
          islandSurfacePoint.addScaledVector(islandMorphPoint, influence);
        }
      }
      
      islandSurfacePoint.applyMatrix4(segment.mesh.matrixWorld);
      
      const ix = Math.floor(islandSurfacePoint.x / ISLAND_SURFACE_CELL);
      const iz = Math.floor(islandSurfacePoint.z / ISLAND_SURFACE_CELL);
      const key = `${ix},${iz}`;
      
      const previous = islandSurfaceIndex.get(key);
      if (!previous || islandSurfacePoint.y > previous.y) {
        islandSurfaceIndex.set(key, { x: islandSurfacePoint.x, y: islandSurfacePoint.y, z: islandSurfacePoint.z });
      }
      
      const coastKey = Math.floor(islandSurfacePoint.z / ISLAND_SURFACE_CELL);
      const previousCoast = islandCoastIndex.get(coastKey);
      if (!previousCoast || islandSurfacePoint.x > previousCoast.x) {
        islandCoastIndex.set(coastKey, { x: islandSurfacePoint.x, z: islandSurfacePoint.z });
      }
    }
  }
}

// 2. Retorna a altura (Y) exata do terreno da ilha nas coordenadas (x, z)
function importedSurfaceHeightAt(x, z) {
  if (!islandSurfaceIndex.size) {
    console.warn("Aviso: islandSurfaceIndex está completamente vazio!");
    return 0;
  }
  
  const ix = Math.floor(x / ISLAND_SURFACE_CELL);
  const iz = Math.floor(z / ISLAND_SURFACE_CELL);
  
  let d0 = Infinity, d1 = Infinity, d2 = Infinity, d3 = Infinity;
  let y0 = 0, y1 = 0, y2 = 0, y3 = 0;
  
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const point = islandSurfaceIndex.get(`${ix + dx},${iz + dz}`);
      if (!point) continue;
      
      const distanceSq = (point.x - x) ** 2 + (point.z - z) ** 2;
      if (distanceSq > 72) continue; // <- Se ignorar tudo aqui, a grade está pequena pro tamanho da ilha!
      
      if (distanceSq < d0) {
        d3 = d2; y3 = y2; d2 = d1; y2 = y1; d1 = d0; y1 = y0; d0 = distanceSq; y0 = point.y;
      } else if (distanceSq < d1) {
        d3 = d2; y3 = y2; d2 = d1; y2 = y1; d1 = distanceSq; y1 = point.y;
      } else if (distanceSq < d2) {
        d3 = d2; y3 = y2; d2 = distanceSq; y2 = point.y;
      } else if (distanceSq < d3) {
        d3 = distanceSq; y3 = point.y;
      }
    }
  }
  
  if (!Number.isFinite(d0)) {
    // Se cair aqui, a linha de frente está muito longe de qualquer vértice mapeado no index
    // console.log(`Nenhum ponto encontrado perto de X:${x.toFixed(1)}, Z:${z.toFixed(1)}`);
    return 0.08;
  }
  
  let weightedHeight = 0, totalWeight = 0;
  let weight = 1 / Math.max(0.2, d0); weightedHeight += y0 * weight; totalWeight += weight;
  
  if (Number.isFinite(d1)) { weight = 1 / Math.max(0.2, d1); weightedHeight += y1 * weight; totalWeight += weight; }
  if (Number.isFinite(d2)) { weight = 1 / Math.max(0.2, d2); weightedHeight += y2 * weight; totalWeight += weight; }
  if (Number.isFinite(d3)) { weight = 1 / Math.max(0.2, d3); weightedHeight += y3 * weight; totalWeight += weight; }
  
  return totalWeight > 0 ? weightedHeight / totalWeight : 0.08;
}
function extractCurvePoints(lineMesh, numSamples = 40) {
  const posAttr = lineMesh.geometry.attributes.position;
  if (!posAttr) return [];

  const rawPoints = [];
  const temp = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i++) {
    temp.fromBufferAttribute(posAttr, i);
    rawPoints.push(temp.clone());
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  rawPoints.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  });

  const useX = (maxX - minX) > (maxZ - minZ);
  rawPoints.sort((a, b) => useX ? (a.x - b.x) : (a.z - b.z));

  const sampled = [];
  const step = Math.max(1, Math.floor(rawPoints.length / numSamples));
  for (let i = 0; i < rawPoints.length; i += step) {
    sampled.push(rawPoints[i]);
  }
  if (sampled[sampled.length - 1] !== rawPoints[rawPoints.length - 1]) {
    sampled.push(rawPoints[rawPoints.length - 1]);
  }

  return sampled;
}

function createFrontArea(lineMesh) {
  const geometry = new THREE.BufferGeometry();

  const material = new THREE.MeshBasicMaterial({
    color: 0xffcc00,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });

  const area = new THREE.Mesh(geometry, material);
  area.name = `front-area-${lineMesh.name || 'line'}`;

  lineMesh.userData.curvePoints = extractCurvePoints(lineMesh, 40);

  scene.add(area);
  lineMesh.userData.frontArea = area;

  return area;
}

function updateFrontArea(lineMesh) {
  let area = lineMesh.userData.frontArea;
  if (!area) {
    area = createFrontArea(lineMesh);
  }

  const initialPos = lineMesh.userData.initialLinePosition;
  if (!initialPos) return;

  const currentPos = lineMesh.position;
  const delta = new THREE.Vector3().subVectors(currentPos, initialPos);
  const distance = delta.length();

  if (distance < 0.05) {
    area.visible = false;
    return;
  }

  const curvePoints = lineMesh.userData.curvePoints;
  if (!curvePoints || curvePoints.length < 2) return;

  lineMesh.updateMatrixWorld(true);

  const positions = [];
  const indices = [];

  for (let i = 0; i < curvePoints.length; i++) {
    // Ponto atual no mundo
    const currentWorldPt = curvePoints[i].clone().applyMatrix4(lineMesh.matrixWorld);
    
    // Altura adaptada ao relevo dinâmico da ilha
    currentWorldPt.y = typeof importedSurfaceHeightAt === 'function' 
      ? importedSurfaceHeightAt(currentWorldPt.x, currentWorldPt.z) + 0.12 
      : currentWorldPt.y + 0.08;

    // Ponto de partida inicial (com deslocamento e altura recalculada no ponto de origem)
    const startWorldPt = currentWorldPt.clone().sub(delta);
    startWorldPt.y = typeof importedSurfaceHeightAt === 'function'
      ? importedSurfaceHeightAt(startWorldPt.x, startWorldPt.z) + 0.12
      : startWorldPt.y;

    positions.push(startWorldPt.x, startWorldPt.y, startWorldPt.z);       // Vértice de início (traseira)
    positions.push(currentWorldPt.x, currentWorldPt.y, currentWorldPt.z); // Vértice atual (frente)

    if (i < curvePoints.length - 1) {
      const idx = i * 2;
      indices.push(idx, idx + 1, idx + 2);
      indices.push(idx + 2, idx + 1, idx + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  if (area.geometry) {
    area.geometry.dispose();
  }

  area.geometry = geometry;
  area.visible = true;
}

function resetFrontArea(lineMesh) {
  if (!lineMesh) return;
  if (lineMesh.userData.frontArea) {
    lineMesh.userData.frontArea.visible = false;
  }
}


function updateFrontLines(penW, ci, time) { const isEnabled = penW > 0.01;

  if (flagMeshes && flagMeshes.length > 0) {
    flagMeshes.forEach(flag => {
      flag.visible = isEnabled;
    });
  }

  if (window.__frontLineMeshes && flagMeshes.length > 0) {
    window.__frontLineMeshes.forEach((lineMesh, index) => {
      if (!isEnabled) {
        lineMesh.visible = false;
        if (lineMesh.userData.frontArea) {
          lineMesh.userData.frontArea.visible = false;
        }
        return;
      }

      lineMesh.visible = true;

      if (lineMesh.material) {
        lineMesh.material.polygonOffset = true;
        lineMesh.material.polygonOffsetFactor = -4;
        lineMesh.material.polygonOffsetUnits = -4;
        lineMesh.material.depthWrite = false;
        lineMesh.material.needsUpdate = true;
      }

      const targetFlagIndex = index === 0 ? Math.floor(flagMeshes.length * 0.3) : Math.floor(flagMeshes.length * 0.7);
      const targetFlag = flagMeshes[targetFlagIndex];

      if (targetFlag) {
        if (!lineMesh.userData.initialized) {
          lineMesh.userData.offsetX = lineMesh.position.x - targetFlag.position.x;
          lineMesh.userData.offsetY = lineMesh.position.y - targetFlag.position.y;
          lineMesh.userData.offsetZ = lineMesh.position.z - targetFlag.position.z;
          
          lineMesh.userData.initialLinePosition = new THREE.Vector3(
            targetFlag.position.x + lineMesh.userData.offsetX,
            targetFlag.position.y + lineMesh.userData.offsetY,
            targetFlag.position.z + lineMesh.userData.offsetZ
          );

          createFrontArea(lineMesh);
          lineMesh.userData.initialized = true;
        }

        lineMesh.position.x = targetFlag.position.x + lineMesh.userData.offsetX;
        lineMesh.position.y = (targetFlag.position.y + lineMesh.userData.offsetY) + 0.15;
        lineMesh.position.z = targetFlag.position.z + lineMesh.userData.offsetZ;

        // Chamada limpa (reaproveitando o que está salvo em userData)
        updateFrontArea(lineMesh);
      }
    });
  }
}