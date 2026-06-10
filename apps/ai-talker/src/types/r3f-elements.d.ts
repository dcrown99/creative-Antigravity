import { Object3DNode } from '@react-three/fiber';

declare global {
    namespace JSX {
        interface IntrinsicElements {
            mesh: Object3DNode<THREE.Mesh, typeof THREE.Mesh>;
            boxGeometry: Object3DNode<THREE.BoxGeometry, typeof THREE.BoxGeometry>;
            meshStandardMaterial: Object3DNode<THREE.MeshStandardMaterial, typeof THREE.MeshStandardMaterial>;
            primitive: any; // primitive is special in R3F
        }
    }
}
