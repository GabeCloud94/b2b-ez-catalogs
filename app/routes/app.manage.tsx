import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  IndexTable,
  LegacyCard,
  useIndexResourceState,
  Text,
  useBreakpoints,
  Page,
  LegacyStack,
} from '@shopify/polaris';
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { useLoaderData, useSubmit } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Query for company locations
  const companyLocationsResponse = await admin.graphql(
    `#graphql
    query getCompanyLocations {
      companyLocations (first: 20) {
        edges {
          node {
            id
            name
            externalId
          }
        }
      }
    }`
  );


  const companyLocationsData = await companyLocationsResponse.json();

  // Query for collections
  const collectionsResponse = await admin.graphql(
    `#graphql
    query getCollections {
      collections(first: 250) {
        edges {
          node {
            id
            title
          }
        }
      }
    }`
  );

  const collectionsData = await collectionsResponse.json();

  // Filter company locations without existing collections
  const existingCollections = new Set(collectionsData.data.collections.edges.map((edge: any) => edge.node.title));
  const filteredCompanyLocations = companyLocationsData.data.companyLocations.edges.filter((edge: any) => {
    const collectionName = `${edge.node.name} Catalog`;
    return !existingCollections.has(collectionName) && !edge.node.inCatalog;
  });

  const publicationsResponse = await admin.graphql(
    `#graphql
    query publications {
      publications(first: 1) {
        edges {
          node {
            id
          }
        }
      }
    }`,
  );
  const publicationsData = await publicationsResponse.json();

  return json({
    companyLocations: filteredCompanyLocations,
    publicationsData
  });
}


export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();



  // Extract form data
  const selectedCompanyNames = formData.getAll('selectedCompanyNames');
  const selectedCompanyIds = formData.getAll('selectedCompanyIds');
  const selectedCompanyExternalIds = formData.getAll('selectedCompanyExternalIds');
  const publicationsData = JSON.parse(formData.get('publicationsData') as string);

  const publicationId = publicationsData.data.publications.edges[0]?.node.id;

  const results = await Promise.all(selectedCompanyNames.map(async (companyName, index) => {
    const companyId = selectedCompanyIds[index];

    

    // Create a collection for the company
    const collectionResponse = await admin.graphql(`
      mutation CollectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          userErrors {
            field
            message
          }
          collection {
            id
            title
          }
        }
      }`,
      {
        variables: {
          input: {
            title: `${companyName} Catalog`,
            ruleSet: {
              appliedDisjunctively: false,
              rules: {
                column: "TAG",
                relation: "EQUALS",
                condition: companyName
              }
            }
          }
        },
      }
    );
    const collectionData = await collectionResponse.json();

    const collectionId = collectionData.data.collectionCreate.collection.id;

    // publishablePublish collection
    const publishablePublishResponse = await admin.graphql(
      `#graphql
  mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable {
        availablePublicationsCount {
          count
        }
        resourcePublicationsCount {
          count
        }
      }
      userErrors {
        field
        message
      }
    }
  }`,
  {
    variables: {
      id: collectionId,
      input: [{
        publicationId: publicationId,
      }],
    }
  }
);
    const publishablePublishData = await publishablePublishResponse.json();

    
      const catalogsResponse = await admin.graphql(
        `#graphql
        query getCatalogs($companyLocationId: String!) {
          catalogs (first: 20, query: $companyLocationId) {
            edges {
              node {
                id              
              }
            }
          }
        }`,
        {
          variables: {
            companyLocationId: companyId
          }
        }
      )
      const catalogsData = await catalogsResponse.json();
      const catalogIds = catalogsData.data.catalogs.edges.map((edge: any) => edge.node.id);

      const updateResponseDataArray = [];
      for (const catalogId of catalogIds) {
        const companyLocationsResponse = await admin.graphql(
          `#graphql
          query getCompanyLocation($catalogId: ID!, $companyId: ID!) {
            companyLocation (id: $companyId) {
                  id
                  inCatalog(catalogId: $catalogId) 
                }
          }`,
          {
            variables: {
              catalogId: catalogId,
              companyId: companyId
              
            }
          }
        );
      
        const updateResponseData = await companyLocationsResponse.json();
        updateResponseDataArray.push({catalogId, ...updateResponseData});
      }

          // Extract catalog IDs where inCatalog is true
    const trueCatalogIds = updateResponseDataArray
    .filter((data: any) => data.data.companyLocation.inCatalog)
    .map((data: any) => data.catalogId);

  // Fetch products for each true catalog ID
  const productsResponseDataArray = [];
  for (const trueCatalogId of trueCatalogIds) {
    const productsResponse = await admin.graphql(
      `#graphql
      query getProducts($catalogId: ID!) {
        catalog(id: $catalogId) {
          publication {
            products(first: 250) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        }
      }`,
      {
        variables: {
          catalogId: trueCatalogId
        }
      }
    );

      
      const productsData = await productsResponse.json();
      productsResponseDataArray.push(productsData.data.catalog.publication.products.edges.map((edge: any) => edge.node.id));
  }
  const tagsResponseDataArray = [];
    for (const id of productsResponseDataArray.flat()) {
      const tagsResponse = await admin.graphql(
        `#graphql
        mutation addTags($id: ID!, $tags: [String!]!) {
          tagsAdd(id: $id, tags: $tags) {
            node {
              id
            }
            userErrors {
              message
            }
          }
        }`,
        {
          variables: {
            id: id,
            tags: [companyName] // Assuming you want to add the company name as a tag
          },
        }
      );
      const tagsData = await tagsResponse.json();
      tagsResponseDataArray.push(tagsData);
    }
  

    return { collectionData, catalogsData, updateResponseDataArray, publishablePublishData, productsResponseDataArray, tagsResponseDataArray };

  }));

  return json({ results });
}




export default function ManageCollections() {
  const { companyLocations, publicationsData } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const collections = companyLocations.map(({ node }: { node: { id: string, name: string, externalId: string } }) => ({
    id: node.id,
    name: node.name,
    externalId: node.externalId
  }));

  const resourceName = {
    singular: 'collection',
    plural: 'collections',
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(collections);

  const rowMarkup: JSX.Element[] = collections.map(({ id, name }: { id: string, name: string, externalId: string }, index: number) => (
    <IndexTable.Row
      id={id}
      key={id}
      selected={selectedResources.includes(id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text as="span" truncate>
          {name}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const handleSubmit = () => {
    const formData = new FormData();
    selectedResources.forEach((id) => {
      const company = collections.find((c: { name: string, id: string, externalId: string }) => c.id === id);
      if (company) {
        formData.append('selectedCompanyNames', company.name);
        formData.append('selectedCompanyIds', company.id);
        formData.append('selectedCompanyExternalIds', company.externalId);
      }
    });
    formData.append('publicationsData', JSON.stringify(publicationsData));
    submit(formData, { method: 'post' });
  };

  const promotedBulkActions = [
    {
      content: 'Create collections',
      onAction: handleSubmit
    }
  ];

  return (
    <Page>
      <LegacyStack vertical>
        <TitleBar title="Manage Collections" />
        <Text variant="headingMd" as="h2">Instructions for use</Text>
        <Text variant="bodyMd" as="p">Select the companies you wish to create collections for, then select 'Create collections' to create collections containing all products within the catalog for each company. Companies with existing collections are not shown.</Text>
        <LegacyCard>
          <IndexTable
            condensed={useBreakpoints().smDown}
            resourceName={resourceName}
            itemCount={collections.length}
            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
            promotedBulkActions={promotedBulkActions}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: 'Companies' },
            ]}
          >
            {rowMarkup}
          </IndexTable>
        </LegacyCard>
      </LegacyStack>
    </Page>
  );
}

