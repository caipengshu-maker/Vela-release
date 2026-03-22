// Quick diagnostic: load VRM and check arm offset resolution
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, VRMHumanBoneName } from '@pixiv/three-vrm';
import * as THREE from 'three';
import fs from 'fs';

const VRM_PATH = 'D:/Vela/assets/avatars/eku/Eku_VRM_v1_0_0.vrm';
const data = fs.readFileSync(VRM_PATH);
const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

const dracoLoader = null; // not needed for VRM

loader.parse(arrayBuffer, '', (gltf) => {
  const vrm = gltf.userData.vrm;
  if (!vrm) { console.log('No VRM found'); process.exit(1); }
  
  VRMUtils.rotateVRM0(vrm);
  
  // Check arm bones
  const arms = ['LeftUpperArm', 'RightUpperArm', 'LeftLowerArm', 'RightLowerArm'];
  arms.forEach(name => {
    const enumVal = VRMHumanBoneName[name];
    const norm = vrm.humanoid?.getNormalizedBoneNode(enumVal);
    const raw = vrm.humanoid?.getRawBoneNode(enumVal);
    const node = norm || raw;
    if (node) {
      node.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3();
      node.getWorldPosition(pos);
      console.log(`${name}: pos=(${pos.x.toFixed(3)},${pos.y.toFixed(3)},${pos.z.toFixed(3)}) quat=(${node.quaternion.x.toFixed(4)},${node.quaternion.y.toFixed(4)},${node.quaternion.z.toFixed(4)},${node.quaternion.w.toFixed(4)})`);
    } else {
      console.log(`${name}: NOT FOUND`);
    }
  });

  // Test arm offset candidates for left arm
  const leftUpper = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
  const leftLower = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm);
  if (leftUpper && leftLower) {
    const initialQuat = leftUpper.quaternion.clone();
    const candidates = [
      { label: "z70", x: 0, y: 0, z: 1.22 },
      { label: "x70", x: -1.22, y: 0, z: 0 },
      { label: "x-70", x: 1.22, y: 0, z: 0 },
      { label: "zx", x: 0.24, y: 0, z: 1.08 },
      { label: "xy", x: -0.9, y: 0.32, z: 0 },
      { label: "yz", x: 0, y: 0.9, z: 0.5 }
    ];
    
    const shoulderPos = new THREE.Vector3();
    const elbowPos = new THREE.Vector3();
    const armDir = new THREE.Vector3();
    const euler = new THREE.Euler();
    const q = new THREE.Quaternion();
    
    console.log('\n--- Left arm candidates ---');
    candidates.forEach(c => {
      euler.set(c.x, c.y, c.z, 'XYZ');
      q.setFromEuler(euler);
      leftUpper.quaternion.copy(initialQuat).multiply(q);
      leftUpper.updateWorldMatrix(true, true);
      leftLower.updateWorldMatrix(true, false);
      
      leftUpper.getWorldPosition(shoulderPos);
      leftLower.getWorldPosition(elbowPos);
      armDir.copy(elbowPos).sub(shoulderPos).normalize();
      
      const downward = -armDir.y;
      const side = armDir.x;
      const fwdPenalty = Math.abs(armDir.z);
      const score = downward * 0.72 + side * 0.26 - fwdPenalty * 0.14;
      
      console.log(`  ${c.label}: dir=(${armDir.x.toFixed(3)},${armDir.y.toFixed(3)},${armDir.z.toFixed(3)}) down=${downward.toFixed(3)} side=${side.toFixed(3)} fwd=${armDir.z.toFixed(3)} score=${score.toFixed(3)}`);
    });
    
    leftUpper.quaternion.copy(initialQuat);
  }
  
  process.exit(0);
}, (err) => {
  console.error('Load error:', err);
  process.exit(1);
});
