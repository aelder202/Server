import { CoordGrid } from '#/engine/CoordGrid.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ZoneMap from '#/engine/zone/ZoneMap.js';
import RebuildNormal from '#/network/game/server/model/RebuildNormal.js';

export const BUILD_AREA_RADIUS_ZONES = 6;
export const BUILD_AREA_SIZE = (BUILD_AREA_RADIUS_ZONES * 2 + 1) << 3;
const BUILD_AREA_REBUILD_RADIUS_ZONES = 4;
// Keep dynamic ground objects and location changes available throughout the
// full client build area so an extended camera does not reveal stale scenery.
const ACTIVE_ZONE_RADIUS = BUILD_AREA_RADIUS_ZONES;

export default class BuildArea {
    // constructor
    readonly player: Player;
    readonly loadedZones: Set<number>;
    readonly activeZones: Set<number>;
    readonly mapsquares: Set<number>;
    
    lastBuild: number = -1;

    constructor(player: Player) {
        this.player = player;
        this.loadedZones = new Set();
        this.activeZones = new Set();
        this.mapsquares = new Set();
    }

    clear(reconnecting: boolean): void {
        if (!reconnecting) {
            this.activeZones.clear();
            this.loadedZones.clear();
            this.mapsquares.clear();
        }
    }

    rebuildZones(): void {
        // update any newly tracked zones
        this.activeZones.clear();

        const centerX = CoordGrid.zone(this.player.x);
        const centerZ = CoordGrid.zone(this.player.z);

        const originX: number = CoordGrid.zone(this.player.originX);
        const originZ: number = CoordGrid.zone(this.player.originZ);

        const leftX = originX - BUILD_AREA_RADIUS_ZONES;
        const rightX = originX + BUILD_AREA_RADIUS_ZONES;
        const topZ = originZ + BUILD_AREA_RADIUS_ZONES;
        const bottomZ = originZ - BUILD_AREA_RADIUS_ZONES;

        for (let x = centerX - ACTIVE_ZONE_RADIUS; x <= centerX + ACTIVE_ZONE_RADIUS; x++) {
            for (let z = centerZ - ACTIVE_ZONE_RADIUS; z <= centerZ + ACTIVE_ZONE_RADIUS; z++) {
                // check if the zone is within the build area
                if (x < leftX || x > rightX || z > topZ || z < bottomZ) {
                    continue;
                }
                this.activeZones.add(ZoneMap.zoneIndex(x << 3, z << 3, this.player.level));
            }
        }
    }

    rebuildNormal(reconnect: boolean = false): void {
        const originX: number = CoordGrid.zone(this.player.originX);
        const originZ: number = CoordGrid.zone(this.player.originZ);

        const reloadLeftX = (originX - BUILD_AREA_REBUILD_RADIUS_ZONES) << 3;
        const reloadRightX = (originX + BUILD_AREA_REBUILD_RADIUS_ZONES + 1) << 3;
        const reloadTopZ = (originZ + BUILD_AREA_REBUILD_RADIUS_ZONES + 1) << 3;
        const reloadBottomZ = (originZ - BUILD_AREA_REBUILD_RADIUS_ZONES) << 3;

        // if the build area should be regenerated, do so now
        if (this.player.x < reloadLeftX || this.player.z < reloadBottomZ || this.player.x > reloadRightX - 1 || this.player.z > reloadTopZ - 1 || reconnect) {
            const zoneX: number = CoordGrid.zone(this.player.x);
            const zoneZ: number = CoordGrid.zone(this.player.z);

            this.mapsquares.clear();
            const minX: number = zoneX - BUILD_AREA_RADIUS_ZONES;
            const maxX: number = zoneX + BUILD_AREA_RADIUS_ZONES;
            const minZ: number = zoneZ - BUILD_AREA_RADIUS_ZONES;
            const maxZ: number = zoneZ + BUILD_AREA_RADIUS_ZONES;

            // build area is 13x13 zones (8*13 = 104 tiles), so we need to load 6 zones in each direction
            for (let x: number = minX; x <= maxX; x++) {
                const mx: number = CoordGrid.mapsquare(x << 3);
                for (let z: number = minZ; z <= maxZ; z++) {
                    const mz: number = CoordGrid.mapsquare(z << 3);
                    this.mapsquares.add((mx << 8) | mz);
                }
            }

            this.player.write(new RebuildNormal(zoneX, zoneZ, this.mapsquares));

            this.player.originX = this.player.x;
            this.player.originZ = this.player.z;
            this.loadedZones.clear();
            this.lastBuild = World.currentTick; // DO NOT DELETE THIS NO MATTER WHAT ??
        }
    }
}
