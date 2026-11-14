export interface RoomOption {
  value: string;
  label: string;
  floor: string;
  sharing: string;
}

export const PG_ROOMS: RoomOption[] = [
  // Floor 1 (101 - 110)
  ...Array.from({ length: 10 }, (_, i) => {
    const num = String(101 + i);
    return {
      value: num,
      label: `Room ${num}`,
      floor: '1st Floor',
      sharing: i < 4 ? 'Single / Double' : 'Double Sharing',
    };
  }),
  // Floor 2 (201 - 210)
  ...Array.from({ length: 10 }, (_, i) => {
    const num = String(201 + i);
    return {
      value: num,
      label: `Room ${num}`,
      floor: '2nd Floor',
      sharing: 'Double / Triple Sharing',
    };
  }),
  // Floor 3 (301 - 310)
  ...Array.from({ length: 10 }, (_, i) => {
    const num = String(301 + i);
    return {
      value: num,
      label: `Room ${num}`,
      floor: '3rd Floor',
      sharing: 'Double / Triple Sharing',
    };
  }),
  // Floor 4 (401 - 410)
  ...Array.from({ length: 10 }, (_, i) => {
    const num = String(401 + i);
    return {
      value: num,
      label: `Room ${num}`,
      floor: '4th Floor',
      sharing: 'Double Sharing',
    };
  }),
  // Floor 5 (501 - 510)
  ...Array.from({ length: 10 }, (_, i) => {
    const num = String(501 + i);
    return {
      value: num,
      label: `Room ${num}`,
      floor: '5th Floor',
      sharing: 'Single / Double',
    };
  }),
  // Extended Annex Wing up to 8010
  ...Array.from({ length: 10 }, (_, i) => {
    const num = String(8001 + i);
    return {
      value: num,
      label: `Room ${num}`,
      floor: 'Annex / Top Wing',
      sharing: 'Triple Sharing',
    };
  }),
  // Shared Halls
  { value: 'Hall-A', label: 'Hall-A', floor: 'Ground / Mezzanine', sharing: '4-Sharing Hall' },
  { value: 'Hall-B', label: 'Hall-B', floor: '2nd Floor', sharing: '4-Sharing Hall' },
  { value: 'Hall-C', label: 'Hall-C', floor: '3rd Floor', sharing: '4-Sharing Hall' },
  { value: 'Hall-D', label: 'Hall-D', floor: '4th Floor', sharing: '6-Sharing Hall' },
];
