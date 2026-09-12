export type ParsedMapAddress = {
  line1: string;
  city: string;
  state: string;
  pincode: string;
  formatted: string;
  lat: number;
  lng: number;
};

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function component(
  components: AddressComponent[],
  type: string
): string {
  const match = components.find((item) => item.types.includes(type));
  return match?.long_name?.trim() ?? "";
}

export function parseGoogleAddress(
  components: AddressComponent[],
  formattedAddress: string,
  lat: number,
  lng: number
): ParsedMapAddress {
  const streetNumber = component(components, "street_number");
  const route = component(components, "route");
  const premise = component(components, "premise");
  const sublocality =
    component(components, "sublocality_level_1") ||
    component(components, "sublocality") ||
    component(components, "neighborhood");
  const line1Parts = [streetNumber, route || premise, sublocality].filter(
    Boolean
  );
  const line1 =
    line1Parts.join(", ") ||
    formattedAddress.split(",")[0]?.trim() ||
    formattedAddress;

  const city =
    component(components, "locality") ||
    component(components, "administrative_area_level_3") ||
    component(components, "administrative_area_level_2") ||
    "";

  return {
    line1,
    city,
    state: component(components, "administrative_area_level_1"),
    pincode: component(components, "postal_code"),
    formatted: formattedAddress,
    lat,
    lng,
  };
}
