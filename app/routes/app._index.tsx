import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  Page,
  BlockStack,
  Button,
  Text,
  List
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query {
      shop {
        myshopifyDomain
      }
  }`,
  );


  const data = await response.json();
  return json({
    data,
    
  });
};

export default function Index() {
  const { data,  } = useLoaderData<typeof loader>();


  const handleDeepLink = () => {
    const openUrl = `https://${data.data.shop.myshopifyDomain}/admin/themes/current/editor?context=apps&template=index&activateAppId=4295a453-8591-40ee-945c-a97021d386e2/gc-app`;
    window.open(openUrl, "_blank");
  }

  return (
    <Page>
      <TitleBar title="Installation Instructions">
      </TitleBar>
      <BlockStack gap="500">
        <img style={{maxWidth:1000, width:'99%'}} width={1000} src={`/instructions.jpg`} alt="instructions" />
        <Text variant="headingXl" as="h4">Installation Instructions</Text>
        <List type="number">
          <List.Item>Click the green "Install" button below.</List.Item>
          <List.Item>Hit the "Save" button in the top-right corner.</List.Item>
          <List.Item>Come back to this app's "Manage Collections" tab on the left-hand side.</List.Item>
          <List.Item>On that page, select all locations and hit the "Create collections" button to create a collection for each location in your store.</List.Item>
          <List.Item>Now, your B2B customers have a list of collections with their assigned company location's catalogs with B2B pricing.</List.Item>
        </List>
        <Button variant="primary" tone="success" onClick={handleDeepLink}>
          Install
        </Button>
      </BlockStack>
    </Page>
  );
}
