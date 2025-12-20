import { gql } from "@apollo/client";

/** Campaign list item returned by the inventory API. */
export type CampagneInventaire = {
  /** Unique identifier for the campaign. */
  id: string;
  /** Functional campaign code shown to the user. */
  code_campagne: string;
  /** Display name for the campaign. */
  nom: string;
  /** Optional campaign start date (YYYY-MM-DD). */
  date_debut: string | null;
  /** Optional campaign end date (YYYY-MM-DD). */
  date_fin: string | null;
};

/** Variables for the campagneinventaires query. */
export type CampagneInventaireListVariables = {
  /** Optional substring filter for campaign codes. */
  codeContains?: string | null;
  /** Optional substring filter for campaign names. */
  nameContains?: string | null;
  /** Optional limit for query results. */
  limit?: number | null;
};

/** Response payload for the campagneinventaires query. */
export type CampagneInventaireListData = {
  /** Campaign list returned by the API. */
  campagneinventaires: CampagneInventaire[];
};

/** GraphQL query for listing inventory campaigns. */
export const CAMPAGNE_INVENTAIRE_LIST_QUERY = gql`
  query CampagneInventaireList(
    $codeContains: String
    $nameContains: String
    $limit: Int
  ) {
    campagneinventaires(
      code_campagne__icontains: $codeContains
      nom__icontains: $nameContains
      limit: $limit
      ordering: "nom"
    ) {
      id
      code_campagne
      nom
      date_debut
      date_fin
    }
  }
`;

/** User summary needed to render a comptage group owner. */
export type ComptageUser = {
  /** Unique identifier for the user. */
  id: string;
  /** Username used for login and display. */
  username: string;
};

/** GroupeComptage list item returned by the inventory API. */
export type GroupeComptage = {
  /** Unique identifier for the group. */
  id: string;
  /** Display name for the comptage group. */
  nom: string;
  /** Device identifier attached to the group. */
  appareil_identifiant: string;
  /** Role string for the group (COMPTAGE). */
  role: string;
  /** User assigned to the group. */
  utilisateur: ComptageUser;
};

/** Variables for the groupecomptages query. */
export type GroupeComptageListVariables = {
  /** Optional campaign id filter. */
  campagne?: string | null;
  /** Optional user id filter. */
  utilisateur?: string | null;
  /** Optional role filter, typically COMPTAGE. */
  role?: string | null;
  /** Optional limit for query results. */
  limit?: number | null;
};

/** Response payload for the groupecomptages query. */
export type GroupeComptageListData = {
  /** Group list returned by the API. */
  groupecomptages: GroupeComptage[];
};

/** GraphQL query for listing comptage groups. */
export const GROUPE_COMPTAGE_LIST_QUERY = gql`
  query GroupeComptageList(
    $campagne: ID
    $utilisateur: ID
    $role: String
    $limit: Int
  ) {
    groupecomptages(
      campagne: $campagne
      utilisateur: $utilisateur
      role: $role
      limit: $limit
      ordering: "nom"
    ) {
      id
      nom
      appareil_identifiant
      role
      utilisateur {
        id
        username
      }
    }
  }
`;

/** Location list item returned by the inventory API. */
export type Location = {
  /** Unique identifier for the location. */
  id: string;
  /** Display name for the location. */
  locationname: string;
  /** Optional description text. */
  desc: string | null;
  /** Optional barcode for scanning the location. */
  barcode: string | null;
  /** Optional parent location for hierarchy display. */
  parent: LocationParent | null;
};

/** Parent location summary used in location listings. */
export type LocationParent = {
  /** Unique identifier for the parent location. */
  id: string;
  /** Display name for the parent location. */
  locationname: string;
};

/** Variables for the locations query. */
export type LocationListVariables = {
  /** Optional substring filter for location names. */
  nameContains?: string | null;
  /** Optional barcode filter for direct lookup. */
  barcode?: string | null;
  /** Optional parent id filter for hierarchy. */
  parent?: string | null;
  /** Optional limit for query results. */
  limit?: number | null;
};

/** Response payload for the locations query. */
export type LocationListData = {
  /** Location list returned by the API. */
  locations: Location[];
};

/** GraphQL query for listing locations. */
export const LOCATION_LIST_QUERY = gql`
  query LocationList(
    $nameContains: String
    $barcode: String
    $parent: ID
    $limit: Int
  ) {
    locations(
      locationname__icontains: $nameContains
      barcode: $barcode
      parent: $parent
      limit: $limit
      ordering: "locationname"
    ) {
      id
      locationname
      desc
      barcode
      parent {
        id
        locationname
      }
    }
  }
`;

/** Input payload for creating an inventory scan. */
export type EnregistrementInventaireInput = {
  /** Campaign id associated with the scan. */
  campagne: string;
  /** Comptage group id associated with the scan. */
  groupe: string;
  /** Location id associated with the scan. */
  lieu: string;
  /** Optional department id for the scan context. */
  departement?: string | null;
  /** Optional article id if the code matched a known article. */
  article?: string | null;
  /** Scanned article code. */
  code_article: string;
  /** Optional capture timestamp in ISO format. */
  capture_le?: string | null;
  /** Optional scan source (camera, manual). */
  source_scan?: string | null;
  /** Optional capture metadata payload. */
  donnees_capture?: string | null;
  /** Optional operator comment. */
  commentaire?: string | null;
};

/** Variables for the create_enregistrementinventaire mutation. */
export type CreateEnregistrementInventaireVariables = {
  /** Mutation input payload. */
  input: EnregistrementInventaireInput;
};

/** Mutation response error item. */
export type MutationError = {
  /** Field name tied to the error. */
  field: string;
  /** Error messages for the field. */
  messages: string[];
};

/** Minimal scan record returned after creation. */
export type EnregistrementInventaireResult = {
  /** Unique identifier for the scan record. */
  id: string;
  /** Scanned article code. */
  code_article: string;
  /** Capture timestamp. */
  capture_le: string | null;
};

/** Response payload for create_enregistrementinventaire. */
export type CreateEnregistrementInventaireData = {
  /** Mutation wrapper with status and created scan record. */
  create_enregistrementinventaire: {
    /** Success flag returned by the API. */
    ok: boolean | null;
    /** Any field-level validation errors. */
    errors: MutationError[] | null;
    /** Created scan record if successful. */
    enregistrementinventaire: EnregistrementInventaireResult | null;
  } | null;
};

/** GraphQL mutation for creating a scan record. */
export const CREATE_ENREGISTREMENT_INVENTAIRE_MUTATION = gql`
  mutation CreateEnregistrementInventaire(
    $input: EnregistrementInventaireCreateGenericType!
  ) {
    create_enregistrementinventaire(input: $input) {
      ok
      errors {
        field
        messages
      }
      enregistrementinventaire {
        id
        code_article
        capture_le
      }
    }
  }
`;
