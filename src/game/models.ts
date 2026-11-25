import * as THREE from 'three';

export type TrafficVariant = 'coupe' | 'sedan' | 'hatchback' | 'van' | 'ambulance';

export interface VehicleRig {
  group: THREE.Group;
  variant: TrafficVariant;
  width: number;
  length: number;
  wheels: THREE.Object3D[];
  sirenBlueMat?: THREE.MeshStandardMaterial;
  sirenRedMat?: THREE.MeshStandardMaterial;
  bonusHaloMat?: THREE.MeshBasicMaterial;
  underglowMat?: THREE.MeshBasicMaterial;
}

export class VehicleAssetLibrary {
  public readonly geometries: THREE.BufferGeometry[] = [];
  public readonly materials: THREE.Material[] = [];

  private readonly wheelGeo: THREE.CylinderGeometry;
  private readonly rimGeo: THREE.CylinderGeometry;
  private readonly shadowGeo: THREE.PlaneGeometry;

  private readonly tireMat: THREE.MeshStandardMaterial;
  private readonly rimMat: THREE.MeshStandardMaterial;
  private readonly glassMat: THREE.MeshStandardMaterial;
  private readonly trimMat: THREE.MeshStandardMaterial;
  private readonly chromeMat: THREE.MeshStandardMaterial;
  private readonly headlightMat: THREE.MeshStandardMaterial;
  private readonly taillightMat: THREE.MeshStandardMaterial;
  private readonly shadowMat: THREE.MeshBasicMaterial;
  private readonly ambulanceRoofMat: THREE.MeshStandardMaterial;
  private readonly ambulanceBodyMat: THREE.MeshStandardMaterial;
  private readonly ambulanceStripeMat: THREE.MeshStandardMaterial;
  private readonly ambulanceRedMat: THREE.MeshStandardMaterial;

  private readonly paintMaterials: THREE.MeshPhysicalMaterial[] = [];

  constructor(
    contactShadowTex: THREE.Texture,
    ambulanceRoofTex: THREE.Texture,
  ) {
    this.wheelGeo = this.trackGeo(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14));
    this.wheelGeo.rotateZ(Math.PI / 2);

    this.rimGeo = this.trackGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.3, 10));
    this.rimGeo.rotateZ(Math.PI / 2);

    this.shadowGeo = this.trackGeo(new THREE.PlaneGeometry(1, 1));
    this.shadowGeo.rotateX(-Math.PI / 2);

    this.tireMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x11141a,
        roughness: 0.9,
        metalness: 0.05,
      }),
    );

    this.rimMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xdbe5f5,
        roughness: 0.22,
        metalness: 0.9,
      }),
    );

    this.glassMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        roughness: 0.08,
        metalness: 0.88,
      }),
    );

    this.trimMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1a1f2b,
        roughness: 0.82,
        metalness: 0.2,
      }),
    );

    this.chromeMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.16,
        metalness: 0.95,
      }),
    );

    this.headlightMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfff5d6,
        emissiveIntensity: 2.3,
        roughness: 0.15,
        metalness: 0.1,
      }),
    );

    this.taillightMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xff2a44,
        emissive: 0xff1e38,
        emissiveIntensity: 2.2,
        roughness: 0.2,
        metalness: 0.1,
      }),
    );

    this.shadowMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.65,
      }),
    );

    this.ambulanceBodyMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.26,
        metalness: 0.18,
      }),
    );

    this.ambulanceRoofMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        map: ambulanceRoofTex,
        roughness: 0.35,
        metalness: 0.1,
      }),
    );

    this.ambulanceStripeMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.15,
      }),
    );

    this.ambulanceRedMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.2,
      }),
    );

    const palette = [
      0xdc2626, // Racing crimson
      0x2563eb, // Electric cobalt
      0xf97316, // Burnt tangerine
      0x10b981, // Emerald sport
      0xcbd5e1, // Metallic silver
      0xeab308, // Signal gold
      0x8b5cf6, // Deep violet
      0x06b6d4, // Ice cyan
    ];

    for (const hex of palette) {
      this.paintMaterials.push(
        this.trackMat(
          new THREE.MeshPhysicalMaterial({
            color: hex,
            roughness: 0.28,
            metalness: 0.55,
            clearcoat: 0.85,
            clearcoatRoughness: 0.14,
          }),
        ),
      );
    }
  }

  private trackGeo<T extends THREE.BufferGeometry>(geo: T): T {
    this.geometries.push(geo);
    return geo;
  }

  private trackMat<T extends THREE.Material>(mat: T): T {
    this.materials.push(mat);
    return mat;
  }

  private addWheels(
    group: THREE.Group,
    halfWidth: number,
    frontZ: number,
    rearZ: number,
    wheelScale = 1,
  ): THREE.Object3D[] {
    const wheels: THREE.Object3D[] = [];
    const positions: [number, number][] = [
      [-halfWidth, frontZ],
      [halfWidth, frontZ],
      [-halfWidth, rearZ],
      [halfWidth, rearZ],
    ];
    for (const [x, z] of positions) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, 0.36 * wheelScale, z);
      wheelGroup.scale.setScalar(wheelScale);

      const tire = new THREE.Mesh(this.wheelGeo, this.tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(this.rimGeo, this.rimMat);
      wheelGroup.add(rim);

      group.add(wheelGroup);
      wheels.push(wheelGroup);
    }
    return wheels;
  }

  private addContactShadow(group: THREE.Group, w: number, l: number): void {
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.scale.set(w * 1.32, l * 1.24, 1);
    shadow.position.y = 0.03;
    group.add(shadow);
  }

  /**
   * Player's signature Black SUV (faces -Z, up the highway)
   * Composite 11-part luxury dark-obsidian SUV with clearcoat finish, LED lightbars, roof rails, and underglow.
   */
  public createPlayerSUV(): VehicleRig {
    const group = new THREE.Group();

    const suvPaint = this.trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x0a0d14,
        roughness: 0.22,
        metalness: 0.72,
        clearcoat: 1.0,
        clearcoatRoughness: 0.09,
      }),
    );

    const suvHeadlightMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xccf8ff,
        emissiveIntensity: 2.8,
        roughness: 0.1,
      }),
    );

    const underglowMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      }),
    );

    const beamMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x7df9ff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );

    // 1. Contact shadow
    this.addContactShadow(group, 2.15, 4.5);

    // 2. Subtle neon underglow rim
    const glowGeo = this.trackGeo(new THREE.PlaneGeometry(2.35, 4.65));
    glowGeo.rotateX(-Math.PI / 2);
    const glowPlane = new THREE.Mesh(glowGeo, underglowMat);
    glowPlane.position.y = 0.045;
    group.add(glowPlane);

    // 3. Lower matte bumper/cladding chassis
    const lowerGeo = this.trackGeo(new THREE.BoxGeometry(2.04, 0.34, 4.38));
    const lower = new THREE.Mesh(lowerGeo, this.trimMat);
    lower.position.set(0, 0.48, 0);
    lower.castShadow = true;
    lower.receiveShadow = true;
    group.add(lower);

    // 4. Sculpted muscular SUV main body
    const bodyGeo = this.trackGeo(new THREE.BoxGeometry(1.98, 0.56, 4.28));
    const body = new THREE.Mesh(bodyGeo, suvPaint);
    body.position.set(0, 0.88, 0.02);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 5. Raised front power-dome hood
    const hoodGeo = this.trackGeo(new THREE.BoxGeometry(1.74, 0.14, 1.38));
    const hood = new THREE.Mesh(hoodGeo, suvPaint);
    hood.position.set(0, 1.2, -1.32);
    hood.castShadow = true;
    group.add(hood);

    // 6. Upper SUV cabin greenhouse
    const cabinGeo = this.trackGeo(new THREE.BoxGeometry(1.78, 0.68, 2.38));
    const cabin = new THREE.Mesh(cabinGeo, this.glassMat);
    cabin.position.set(0, 1.46, 0.34);
    cabin.castShadow = true;
    group.add(cabin);

    // 7. Glossy black roof cap + roof rails
    const roofGeo = this.trackGeo(new THREE.BoxGeometry(1.72, 0.12, 2.22));
    const roof = new THREE.Mesh(roofGeo, suvPaint);
    roof.position.set(0, 1.82, 0.38);
    roof.castShadow = true;
    group.add(roof);

    const railGeo = this.trackGeo(new THREE.BoxGeometry(0.08, 0.08, 1.95));
    const leftRail = new THREE.Mesh(railGeo, this.chromeMat);
    leftRail.position.set(-0.74, 1.91, 0.38);
    const rightRail = new THREE.Mesh(railGeo, this.chromeMat);
    rightRail.position.set(0.74, 1.91, 0.38);
    group.add(leftRail, rightRail);

    // 8. Front chrome grille & aggressive bull-bar trim (facing -Z)
    const grilleGeo = this.trackGeo(new THREE.BoxGeometry(1.16, 0.32, 0.1));
    const grille = new THREE.Mesh(grilleGeo, this.chromeMat);
    grille.position.set(0, 0.8, -2.14);
    group.add(grille);

    // 9. Front LED headlights + projected road light cones (-Z)
    const headGeo = this.trackGeo(new THREE.BoxGeometry(0.42, 0.16, 0.1));
    const headL = new THREE.Mesh(headGeo, suvHeadlightMat);
    headL.position.set(-0.72, 0.92, -2.13);
    const headR = new THREE.Mesh(headGeo, suvHeadlightMat);
    headR.position.set(0.72, 0.92, -2.13);
    group.add(headL, headR);

    const beamGeo = this.trackGeo(new THREE.PlaneGeometry(0.95, 5.2));
    beamGeo.rotateX(-Math.PI / 2);
    const beamL = new THREE.Mesh(beamGeo, beamMat);
    beamL.position.set(-0.68, 0.05, -4.65);
    const beamR = new THREE.Mesh(beamGeo, beamMat);
    beamR.position.set(0.68, 0.05, -4.65);
    group.add(beamL, beamR);

    // 10. Signature wide red LED rear lightbar (+Z) + twin chrome exhausts
    const rearBarGeo = this.trackGeo(new THREE.BoxGeometry(1.76, 0.14, 0.1));
    const rearBar = new THREE.Mesh(rearBarGeo, this.taillightMat);
    rearBar.position.set(0, 1.0, 2.15);
    group.add(rearBar);

    const exhaustGeo = this.trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 8));
    exhaustGeo.rotateX(Math.PI / 2);
    const exL = new THREE.Mesh(exhaustGeo, this.chromeMat);
    exL.position.set(-0.62, 0.38, 2.2);
    const exR = new THREE.Mesh(exhaustGeo, this.chromeMat);
    exR.position.set(0.62, 0.38, 2.2);
    group.add(exL, exR);

    // 11. 4 chunky SUV alloy wheels
    const wheels = this.addWheels(group, 1.02, -1.36, 1.38, 1.15);

    return {
      group,
      variant: 'sedan',
      width: 2.02,
      length: 4.35,
      wheels,
      underglowMat,
    };
  }

  /**
   * Oncoming normal traffic vehicles (face +Z, descending top-to-bottom toward the player)
   */
  public createTrafficCar(variant: Exclude<TrafficVariant, 'ambulance'>, colorIndex: number): VehicleRig {
    const group = new THREE.Group();
    const paint = this.paintMaterials[colorIndex % this.paintMaterials.length];

    let width = 1.82;
    let length = 3.9;

    if (variant === 'coupe') {
      width = 1.86;
      length = 3.95;
      this.addContactShadow(group, width, length);

      const lower = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.84, 0.26, 3.92)), this.trimMat);
      lower.position.set(0, 0.38, 0);
      group.add(lower);

      const body = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.82, 0.44, 3.84)), paint);
      body.position.set(0, 0.68, 0);
      body.castShadow = true;
      group.add(body);

      const cabin = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.5, 0.44, 1.85)), this.glassMat);
      cabin.position.set(0, 1.08, -0.15);
      cabin.castShadow = true;
      group.add(cabin);

      const roof = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.42, 0.08, 1.4)), paint);
      roof.position.set(0, 1.32, -0.2);
      group.add(roof);

      // Sport rear spoiler (-Z)
      const wing = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.7, 0.07, 0.28)), this.trimMat);
      wing.position.set(0, 1.04, -1.72);
      group.add(wing);

      // Bright oncoming headlights (+Z)
      const headGeo = this.trackGeo(new THREE.BoxGeometry(0.42, 0.14, 0.1));
      const hL = new THREE.Mesh(headGeo, this.headlightMat);
      hL.position.set(-0.62, 0.72, 1.92);
      const hR = new THREE.Mesh(headGeo, this.headlightMat);
      hR.position.set(0.62, 0.72, 1.92);
      group.add(hL, hR);

      const tail = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.55, 0.11, 0.08)), this.taillightMat);
      tail.position.set(0, 0.78, -1.92);
      group.add(tail);

      const wheels = this.addWheels(group, 0.92, 1.24, -1.24, 0.96);
      return { group, variant, width, length, wheels };
    }

    if (variant === 'hatchback') {
      width = 1.76;
      length = 3.35;
      this.addContactShadow(group, width, length);

      const lower = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.74, 0.26, 3.32)), this.trimMat);
      lower.position.set(0, 0.38, 0);
      group.add(lower);

      const body = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.72, 0.52, 3.24)), paint);
      body.position.set(0, 0.74, 0);
      body.castShadow = true;
      group.add(body);

      const cabin = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.52, 0.56, 1.92)), this.glassMat);
      cabin.position.set(0, 1.24, -0.35);
      cabin.castShadow = true;
      group.add(cabin);

      const roof = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.48, 0.09, 1.72)), paint);
      roof.position.set(0, 1.54, -0.35);
      group.add(roof);

      const headGeo = this.trackGeo(new THREE.BoxGeometry(0.36, 0.16, 0.1));
      const hL = new THREE.Mesh(headGeo, this.headlightMat);
      hL.position.set(-0.58, 0.76, 1.62);
      const hR = new THREE.Mesh(headGeo, this.headlightMat);
      hR.position.set(0.58, 0.76, 1.62);
      group.add(hL, hR);

      const tail = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.46, 0.12, 0.08)), this.taillightMat);
      tail.position.set(0, 0.84, -1.62);
      group.add(tail);

      const wheels = this.addWheels(group, 0.88, 1.02, -1.04, 0.92);
      return { group, variant, width, length, wheels };
    }

    if (variant === 'van') {
      width = 1.96;
      length = 4.65;
      this.addContactShadow(group, width, length);

      const lower = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.94, 0.3, 4.62)), this.trimMat);
      lower.position.set(0, 0.42, 0);
      group.add(lower);

      // Front cab (+Z)
      const cab = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.88, 1.18, 1.55)), paint);
      cab.position.set(0, 1.12, 1.48);
      cab.castShadow = true;
      group.add(cab);

      const windshield = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.68, 0.56, 0.8)), this.glassMat);
      windshield.position.set(0, 1.4, 1.88);
      group.add(windshield);

      // Cargo box (-Z)
      const cargoMat = this.trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.45,
          metalness: 0.15,
        }),
      );
      const cargo = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.94, 1.58, 3.0)), cargoMat);
      cargo.position.set(0, 1.34, -0.78);
      cargo.castShadow = true;
      group.add(cargo);

      // Accent stripe along cargo box
      const stripe = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.97, 0.24, 2.94)), paint);
      stripe.position.set(0, 1.24, -0.78);
      group.add(stripe);

      const headGeo = this.trackGeo(new THREE.BoxGeometry(0.4, 0.18, 0.1));
      const hL = new THREE.Mesh(headGeo, this.headlightMat);
      hL.position.set(-0.66, 0.78, 2.26);
      const hR = new THREE.Mesh(headGeo, this.headlightMat);
      hR.position.set(0.66, 0.78, 2.26);
      group.add(hL, hR);

      const wheels = this.addWheels(group, 0.98, 1.45, -1.45, 1.05);
      return { group, variant, width, length, wheels };
    }

    // Default: Modern Sedan
    width = 1.84;
    length = 4.1;
    this.addContactShadow(group, width, length);

    const lower = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.82, 0.26, 4.06)), this.trimMat);
    lower.position.set(0, 0.39, 0);
    group.add(lower);

    const body = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.8, 0.5, 4.0)), paint);
    body.position.set(0, 0.74, 0);
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.56, 0.52, 2.08)), this.glassMat);
    cabin.position.set(0, 1.2, -0.14);
    cabin.castShadow = true;
    group.add(cabin);

    const roof = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.5, 0.08, 1.66)), paint);
    roof.position.set(0, 1.48, -0.16);
    group.add(roof);

    const headGeo = this.trackGeo(new THREE.BoxGeometry(0.4, 0.15, 0.1));
    const hL = new THREE.Mesh(headGeo, this.headlightMat);
    hL.position.set(-0.62, 0.76, 2.0);
    const hR = new THREE.Mesh(headGeo, this.headlightMat);
    hR.position.set(0.62, 0.76, 2.0);
    group.add(hL, hR);

    const tail = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.54, 0.12, 0.08)), this.taillightMat);
    tail.position.set(0, 0.82, -2.0);
    group.add(tail);

    const wheels = this.addWheels(group, 0.91, 1.28, -1.28, 0.98);
    return { group, variant: 'sedan', width, length, wheels };
  }

  /**
   * Bonus Emergency Ambulance (Sanitka) — high-visibility Czech/EU rescue styling
   * Faces +Z (coming down the highway). Colliding with it grants EXTRA POINTS!
   */
  public createAmbulance(): VehicleRig {
    const group = new THREE.Group();
    const width = 2.04;
    const length = 4.6;

    this.addContactShadow(group, width, length);

    // Glowing emerald/gold target aura beneath the ambulance so players recognize it as a bonus target
    const bonusHaloMat = this.trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    const haloGeo = this.trackGeo(new THREE.RingGeometry(1.25, 1.68, 24));
    haloGeo.rotateX(-Math.PI / 2);
    const halo = new THREE.Mesh(haloGeo, bonusHaloMat);
    halo.position.y = 0.05;
    halo.scale.set(0.85, 1.55, 1);
    group.add(halo);

    // Lower bumper/chassis
    const lower = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(2.0, 0.32, 4.56)), this.trimMat);
    lower.position.set(0, 0.44, 0);
    group.add(lower);

    // Front ambulance cab (+Z)
    const cab = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.9, 1.06, 1.5)), this.ambulanceBodyMat);
    cab.position.set(0, 1.08, 1.48);
    cab.castShadow = true;
    group.add(cab);

    const windshield = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.68, 0.52, 0.72)), this.glassMat);
    windshield.position.set(0, 1.36, 1.88);
    group.add(windshield);

    // Rear elevated medical box (-Z)
    const box = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(2.0, 1.48, 3.04)), this.ambulanceBodyMat);
    box.position.set(0, 1.32, -0.74);
    box.castShadow = true;
    group.add(box);

    // Textured roof plate with bold red medical cross
    const roofPlate = new THREE.Mesh(
      this.trackGeo(new THREE.PlaneGeometry(1.88, 2.9)),
      this.ambulanceRoofMat,
    );
    roofPlate.rotation.x = -Math.PI / 2;
    roofPlate.position.set(0, 2.08, -0.74);
    group.add(roofPlate);

    // Hi-vis yellow and red emergency stripes along body
    const yellowBand = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(2.04, 0.24, 4.46)),
      this.ambulanceStripeMat,
    );
    yellowBand.position.set(0, 0.94, -0.02);
    group.add(yellowBand);

    const redBand = new THREE.Mesh(
      this.trackGeo(new THREE.BoxGeometry(2.05, 0.14, 3.0)),
      this.ambulanceRedMat,
    );
    redBand.position.set(0, 1.24, -0.74);
    group.add(redBand);

    // Red emergency cross emblem on front hood (+Z)
    const crossV = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.18, 0.44, 0.08)), this.ambulanceRedMat);
    crossV.position.set(0, 0.9, 2.25);
    const crossH = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(0.44, 0.18, 0.08)), this.ambulanceRedMat);
    crossH.position.set(0, 0.9, 2.25);
    group.add(crossV, crossH);

    // Flashing dual-zone emergency LED lightbar on top of cab
    const sirenBase = new THREE.Mesh(this.trackGeo(new THREE.BoxGeometry(1.42, 0.12, 0.34)), this.trimMat);
    sirenBase.position.set(0, 2.04, 1.12);
    group.add(sirenBase);

    const sirenBlueMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x0088ff,
        emissiveIntensity: 3.4,
        roughness: 0.15,
      }),
    );
    const sirenRedMat = this.trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xff1133,
        emissiveIntensity: 3.4,
        roughness: 0.15,
      }),
    );

    const lightBarHalfGeo = this.trackGeo(new THREE.BoxGeometry(0.62, 0.22, 0.3));
    const sirenLeft = new THREE.Mesh(lightBarHalfGeo, sirenBlueMat);
    sirenLeft.position.set(-0.36, 2.16, 1.12);
    const sirenRight = new THREE.Mesh(lightBarHalfGeo, sirenRedMat);
    sirenRight.position.set(0.36, 2.16, 1.12);
    group.add(sirenLeft, sirenRight);

    // Bright oncoming headlights (+Z)
    const headGeo = this.trackGeo(new THREE.BoxGeometry(0.42, 0.18, 0.1));
    const hL = new THREE.Mesh(headGeo, this.headlightMat);
    hL.position.set(-0.68, 0.78, 2.25);
    const hR = new THREE.Mesh(headGeo, this.headlightMat);
    hR.position.set(0.68, 0.78, 2.25);
    group.add(hL, hR);

    const wheels = this.addWheels(group, 1.0, 1.45, -1.42, 1.06);

    return {
      group,
      variant: 'ambulance',
      width,
      length,
      wheels,
      sirenBlueMat,
      sirenRedMat,
      bonusHaloMat,
    };
  }

  public dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.geometries.length = 0;
    this.materials.length = 0;
  }
}
