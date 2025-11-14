"use client";
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const Medal3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const width = 28;
    const height = 28;
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    // Medal geometry (coin-like cylinder)
    const geometry = new THREE.CylinderGeometry(1, 1, 0.25, 64, 1, false);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffd700,
      metalness: 1,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      emissive: 0xffe066,
      emissiveIntensity: 0.5,
      sheen: 1,
    });
    const medal = new THREE.Mesh(geometry, material);
    medal.rotation.x = Math.PI / 2; // face the camera
    scene.add(medal);

    // Glow effect
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffff99, transparent: true, opacity: 0.2 });
    const glowGeometry = new THREE.TorusGeometry(1.15, 0.38, 32, 100);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // Light
    const spotLight = new THREE.SpotLight(0xffffff, 2);
    spotLight.position.set(5, 5, 5);
    scene.add(spotLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Animation
    let frameId: number;
    const animate = () => {
      medal.rotation.y += 0.03;
      medal.rotation.x += 0.01;
      glow.rotation.y += 0.03;
      glow.rotation.x += 0.01;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    // Mount
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden' }}
      title="Top Student Medal"
    />
  );
};

export default Medal3D;
