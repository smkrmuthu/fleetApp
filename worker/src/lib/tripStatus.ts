// The status a new movement starts with.
//
// A driver can only ever open a movement, so it starts as a draft. Office and
// Manager may enter a movement that is already fully recorded (weight, start and
// end odometer, every stop reading), which is approved straight away. If any of
// that is still missing it is a draft too: open, able to take fuel and other
// entries, and finished later with "Complete Trip". "pending" is no longer given
// to a new movement; it only remains on older records.
export function newTripStatus(isDriver: boolean, fullyRecorded: boolean): 'draft' | 'approved' {
  return !isDriver && fullyRecorded ? 'approved' : 'draft';
}
