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
  /** PIN code required to validate group selection. */
  pin_code: string;
  /** Role string for the group (COMPTAGE). */
  role: string;
  /** User assigned to the group. */
  utilisateur: ComptageUser;
  /** Campaign summary associated with the group. */
  campagne: GroupeComptageCampagne;
};

/** Campaign summary attached to a comptage group. */
export type GroupeComptageCampagne = {
  /** Unique identifier for the campaign. */
  id: string;
  /** Optional campaign name for display. */
  nom: string | null;
};

/** Variables for the groupecomptages query. */
export type GroupeComptageListVariables = {
  /** Optional substring filter for group names. */
  nameContains?: string | null;
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
    $nameContains: String
    $campagne: ID
    $utilisateur: ID
    $role: String
    $limit: Int
  ) {
    groupecomptages(
      nom__icontains: $nameContains
      campagne: $campagne
      utilisateur: $utilisateur
      role: $role
      limit: $limit
      ordering: "nom"
    ) {
      id
      nom
      appareil_identifiant
      pin_code
      role
      campagne {
        id
        nom
      }
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
  /** Optional list of parent ids for child lookup. */
  parentIn?: string[] | null;
  /** Optional flag to restrict to top-level locations. */
  parentIsNull?: boolean | null;
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
    $parentIn: [ID]
    $parentIsNull: Boolean
    $limit: Int
  ) {
    locations(
      locationname__icontains: $nameContains
      barcode: $barcode
      parent: $parent
      parent__in: $parentIn
      parent__isnull: $parentIsNull
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

/** Article summary returned by affectation lookups. */
export type LocationArticle = {
  /** Unique identifier for the article. */
  id: string;
  /** Article code displayed during counting. */
  code: string;
  /** Optional article description. */
  desc: string | null;
};

/** Location summary returned by affectation lookups. */
export type AffectationLocation = {
  /** Unique identifier for the location. */
  id: string;
  /** Display name for the location. */
  locationname: string;
};

/** Affectation entry used to load articles assigned to a location. */
export type AffectationListItem = {
  /** Unique identifier for the affectation. */
  id: string;
  /** Article linked to the affectation. */
  article: LocationArticle | null;
  /** Location assigned to the affectation. */
  location: AffectationLocation | null;
};

/** Variables for the affectations query. */
export type AffectationListVariables = {
  /** Location id used to filter affectations. */
  location?: string | null;
  /** Optional limit for query results. */
  limit?: number | null;
};

/** Response payload for the affectations query. */
export type AffectationListData = {
  /** Affectations returned by the API. */
  affectations: AffectationListItem[];
};

/** GraphQL query for listing affectations by location. */
export const AFFECTATION_LIST_QUERY = gql`
  query AffectationList($location: ID, $limit: Int) {
    affectations(location: $location, limit: $limit) {
      id
      article {
        id
        code
        desc
      }
      location {
        id
        locationname
      }
    }
  }
`;

/** Article lookup item returned by the inventory API. */
export type ArticleLookup = {
  /** Unique identifier for the article. */
  id: string;
  /** Article code used to match scans. */
  code: string;
  /** Optional article description. */
  desc: string | null;
  /** Affectations linked to the article for location checks. */
  affectation_set: ArticleLookupAffectation[];
};

/** Affectation payload used during article lookup. */
export type ArticleLookupAffectation = {
  /** Location assigned to the article, if any. */
  location: ArticleLookupLocation | null;
};

/** Location summary attached to article lookup responses. */
export type ArticleLookupLocation = {
  /** Unique identifier for the location. */
  id: string;
  /** Display name for the location. */
  locationname: string;
};

/** Variables for the articles lookup query. */
export type ArticleLookupVariables = {
  /** Article codes to resolve. */
  codes: string[];
  /** Optional limit for query results. */
  limit?: number | null;
};

/** Response payload for the articles lookup query. */
export type ArticleLookupData = {
  /** Articles matching the provided codes. */
  articles: ArticleLookup[];
};

/** GraphQL query for resolving article descriptions by code. */
export const ARTICLE_LOOKUP_QUERY = gql`
  query ArticleLookup($codes: [String], $limit: Int) {
    articles(code__in: $codes, limit: $limit) {
      id
      code
      desc
      affectation_set {
        location {
          id
          locationname
        }
      }
    }
  }
`;

/** Article location summary for offline storage. */
export type OfflineArticleLocation = {
  /** Unique identifier for the location. */
  id: string;
  /** Display name for the location. */
  locationname: string;
};

/** Offline article entry used for full cache synchronization. */
export type OfflineArticleEntry = {
  /** Unique identifier for the article. */
  id: string;
  /** Article code used during scanning. */
  code: string;
  /** Optional article description. */
  desc: string | null;
  /** Locations linked to the article via affectations. */
  locations: OfflineArticleLocation[];
};

/** Article list item returned by the offline sync query. */
export type OfflineArticleQueryItem = {
  /** Unique identifier for the article. */
  id: string;
  /** Article code used during scanning. */
  code: string;
  /** Optional article description. */
  desc: string | null;
  /** Affectations linked to the article. */
  affectation_set: OfflineArticleAffectation[];
};

/** Affectation payload used to resolve offline article locations. */
export type OfflineArticleAffectation = {
  /** Location attached to the affectation. */
  location: OfflineArticleLocation | null;
};

/** Response payload for the offline article list query. */
export type OfflineArticleListData = {
  /** Articles returned by the offline sync query. */
  articles: OfflineArticleQueryItem[];
};

/** GraphQL query for loading articles with locations for offline sync. */
export const OFFLINE_ARTICLE_LIST_QUERY = gql`
  query OfflineArticleList($limit: Int) {
    articles(limit: $limit, ordering: "code") {
      id
      code
      desc
      affectation_set {
        location {
          id
          locationname
        }
      }
    }
  }
`;

/** Minimal article details tied to a scan record. */
export type EnregistrementInventaireArticle = {
  /** Unique identifier for the article. */
  id: string;
  /** Optional article description. */
  desc: string | null;
};

/** Scan list item returned by the inventory API. */
export type EnregistrementInventaireListItem = {
  /** Unique identifier for the scan record. */
  id: string;
  /** Scanned article code. */
  code_article: string;
  /** Article details resolved for the scanned code, when available. */
  article: EnregistrementInventaireArticle | null;
  /** Capture timestamp. */
  capture_le: string | null;
};

/** Variables for the enregistrementinventaires query. */
export type EnregistrementInventaireListVariables = {
  /** Campaign id filter for the scan list. */
  campagne?: string | null;
  /** Group id filter for the scan list. */
  groupe?: string | null;
  /** Location id filter for the scan list. */
  lieu?: string | null;
  /** Optional limit for query results. */
  limit?: number | null;
};

/** Response payload for the enregistrementinventaires query. */
export type EnregistrementInventaireListData = {
  /** Scan list returned by the API. */
  enregistrementinventaires: EnregistrementInventaireListItem[];
  /** Total count of scans matching the filters. */
  enregistrementinventaire_count: number | null;
};

/** GraphQL query for listing scan records. */
export const ENREGISTREMENT_INVENTAIRE_LIST_QUERY = gql`
  query EnregistrementInventaireList(
    $campagne: ID
    $groupe: ID
    $lieu: ID
    $limit: Int
  ) {
    enregistrementinventaires(
      campagne: $campagne
      groupe: $groupe
      lieu: $lieu
      limit: $limit
      ordering: "-capture_le"
    ) {
      id
      code_article
      article {
        id
        desc
      }
      capture_le
    }
    enregistrementinventaire_count(
      campagne: $campagne
      groupe: $groupe
      lieu: $lieu
    )
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
  /** Article details resolved for the scanned code, when available. */
  article: EnregistrementInventaireArticle | null;
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
        article {
          id
          desc
        }
        capture_le
      }
    }
  }
`;
