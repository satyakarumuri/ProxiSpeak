
import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";
const ROOM_ID = "office-1";

function Desk({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[2, 0.12, 1]} />
        <meshStandardMaterial color="#9b7653" />
      </mesh>

      {[
        [-0.85, 0.5, -0.35],
        [0.85, 0.5, -0.35],
        [-0.85, 0.5, 0.35],
        [0.85, 0.5, 0.35]
      ].map((leg, index) => (
        <mesh key={index} position={leg} castShadow>
          <boxGeometry args={[0.09, 1, 0.09]} />
          <meshStandardMaterial color="#51443b" />
        </mesh>
      ))}

      <mesh position={[0, 1.42, -0.25]}>
        <boxGeometry args={[0.65, 0.45, 0.08]} />
        <meshStandardMaterial
          color="#172554"
          emissive="#1d4ed8"
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0, 1.18, -0.25]}>
        <boxGeometry args={[0.08, 0.25, 0.08]} />
        <meshStandardMaterial color="#737373" />
      </mesh>

      <mesh position={[0, 0.55, 0.95]}>
        <boxGeometry args={[0.65, 0.12, 0.65]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      <mesh position={[0, 0.95, 1.23]}>
        <boxGeometry args={[0.65, 0.75, 0.12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
}

function AvatarModel({
  name,
  position,
  color = "#38bdf8",
  smooth = false
}) {
  const groupRef = useRef();
  const targetPosition = useRef(new THREE.Vector3(...position));

  useEffect(() => {
    targetPosition.current.set(
      position[0],
      position[1],
      position[2]
    );
  }, [position]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (smooth) {
      groupRef.current.position.lerp(
        targetPosition.current,
        1 - Math.exp(-10 * Math.min(delta, 0.1))
      );
    } else {
      groupRef.current.position.set(
        position[0],
        position[1],
        position[2]
      );
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[0.35, 0.65, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#f0c7a4" />
      </mesh>

      <Html position={[0, 2.35, 0]} center distanceFactor={10}>
        <div className="avatar-label">{name}</div>
      </Html>
    </group>
  );
}

function LocalAvatar({ name, socket, connected }) {
  const avatarRef = useRef();
  const keys = useRef({});
  const lastSent = useRef(0);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)
      ) {
        event.preventDefault();
      }

      keys.current[key] = true;
    };

    const onKeyUp = (event) => {
      keys.current[event.key.toLowerCase()] = false;
    };

    const onBlur = () => {
      keys.current = {};
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useFrame((_, delta) => {
    const avatar = avatarRef.current;
    if (!avatar) return;

    const movement = new THREE.Vector3();
    const pressed = keys.current;

    if (pressed.w || pressed.arrowup) movement.z -= 1;
    if (pressed.s || pressed.arrowdown) movement.z += 1;
    if (pressed.a || pressed.arrowleft) movement.x -= 1;
    if (pressed.d || pressed.arrowright) movement.x += 1;

    if (movement.lengthSq() === 0) return;

    movement.normalize();
    avatar.position.addScaledVector(
      movement,
      4 * Math.min(delta, 0.05)
    );

    avatar.position.x = THREE.MathUtils.clamp(
      avatar.position.x, -9, 9
    );
    avatar.position.z = THREE.MathUtils.clamp(
      avatar.position.z, -7, 7
    );

    const now = performance.now();

    if (connected && socket?.connected && now - lastSent.current >= 66) {
      lastSent.current = now;

      socket.emit("avatar:move", {
        roomId: ROOM_ID,
        position: {
          x: avatar.position.x,
          y: 0,
          z: avatar.position.z
        },
        rotation: 0
      });
    }
  });

  return (
    <group ref={avatarRef} position={[0, 0, 2]}>
      <AvatarModel
        name={name || "You"}
        position={[0, 0, 0]}
      />
    </group>
  );
}

function OfficeEnvironment({ name, socket, connected, remoteUsers }) {
  return (
    <>
      <color attach="background" args={["#dbeafe"]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[5, 10, 5]} intensity={2} castShadow />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.08, 0]}
        receiveShadow
      >
        <planeGeometry args={[22, 18]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>

      <mesh position={[0, 2.5, -9]}>
        <boxGeometry args={[22, 5, 0.2]} />
        <meshStandardMaterial color="#bfdbfe" />
      </mesh>

      <mesh position={[-11, 2.5, 0]}>
        <boxGeometry args={[0.2, 5, 18]} />
        <meshStandardMaterial color="#c7d2fe" />
      </mesh>

      <mesh position={[11, 2.5, 0]}>
        <boxGeometry args={[0.2, 5, 18]} />
        <meshStandardMaterial color="#c7d2fe" />
      </mesh>

      <Desk position={[-5, 0, -3]} />
      <Desk position={[0, 0, -3]} />
      <Desk position={[5, 0, -3]} />
      <Desk position={[-5, 0, 2]} />
      <Desk position={[5, 0, 2]} />

      <LocalAvatar
        name={name}
        socket={socket}
        connected={connected}
      />

      {remoteUsers.map((user, index) => (
        <AvatarModel
          key={user.id}
          name={user.name}
          position={[
            user.position?.x ?? (index % 3) * 2 - 2,
            user.position?.y ?? 0,
            user.position?.z ?? -1
          ]}
          color="#a78bfa"
          smooth
        />
      ))}
    </>
  );
}

export default function OfficeScene({ name = "You" }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [connectionMessage, setConnectionMessage] = useState(
    "Connecting to office..."
  );

  useEffect(() => {
    const token = localStorage.getItem("proxispeak_token");

    if (!token) {
      setConnectionMessage("Please log in again.");
      return;
    }

    const client = io(SOCKET_URL, {
      auth: { token },
      reconnection: true
    });

    setSocket(client);

    client.on("connect", () => {
      setConnected(true);
      setConnectionMessage("Joining office...");

      client.emit(
        "office:join",
        { roomId: ROOM_ID, user: { name } },
        (result) => {
          if (!result?.ok) {
            setConnectionMessage(
              result?.message || "Unable to join office."
            );
            return;
          }

          setRemoteUsers(
            (result.users || []).filter(
              (user) => user.id !== client.id
            )
          );

          setConnectionMessage("Connected to virtual office");
        }
      );
    });

    client.on("connect_error", (error) => {
      setConnected(false);
      setConnectionMessage(`Connection error: ${error.message}`);
    });

    client.on("disconnect", () => {
      setConnected(false);
      setConnectionMessage("Disconnected. Reconnecting...");
      setRemoteUsers([]);
    });

    client.on("office:users", (users) => {
      setRemoteUsers(
        (users || []).filter((user) => user.id !== client.id)
      );
    });

    client.on("office:user-joined", (user) => {
      if (user.id === client.id) return;

      setRemoteUsers((previous) => [
        ...previous.filter((item) => item.id !== user.id),
        user
      ]);
    });

    client.on("avatar:moved", (update) => {
      setRemoteUsers((previous) =>
        previous.map((user) =>
          user.id === update.userId
            ? {
                ...user,
                position: update.position,
                rotation: update.rotation
              }
            : user
        )
      );
    });

    client.on("office:user-left", ({ userId }) => {
      setRemoteUsers((previous) =>
        previous.filter((user) => user.id !== userId)
      );
    });

    return () => {
      client.emit("office:leave");
      client.disconnect();
    };
  }, [name]);

  return (
    <div className="office-canvas">
      <Canvas shadows camera={{ position: [11, 12, 16], fov: 45 }}>
        <OfficeEnvironment
          name={name}
          socket={socket}
          connected={connected}
          remoteUsers={remoteUsers}
        />

        <OrbitControls
          makeDefault
          target={[0, 0.5, 0]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={8}
          maxDistance={28}
        />
      </Canvas>

      <div className="office-controls">
        <strong>Movement controls</strong>
        <span>W A S D or arrow keys</span>
        <span>Drag to rotate · Scroll to zoom</span>
        <span>{connectionMessage}</span>
        <span>People in office: {remoteUsers.length + 1}</span>
      </div>
    </div>
  );
}
