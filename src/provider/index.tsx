import { stringify } from 'query-string';
import { fetchUtils, DataProvider } from 'ra-core';

export type MicroServiceConfig = {
  /**
   * key/value pair representing a resource/microservice url
   */
  [resource: string]: string;
};

export type JsonApiData = {
  /**
   * Entity ID
   */
  id?: number | string;
  /**
   * Entity related attributes
   */
  attributes?: any;
};

const HttpMethods = {
  POST: 'POST',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
};

const mapResponse = ({ id, attributes }: JsonApiData) => ({
  id,
  ...attributes,
});

/**
 * Maps react-admin queries to a Micro Services API
 *
 * @example
 *
 * getList     => GET http://posts.api.url?sort=['title','ASC']&range=[0, 24]
 * getOne      => GET http://posts.api.url/123
 * getMany     => GET http://posts.api.url?filter={id:[123,456,789]}
 * update      => PUT http://posts.api.url/123
 * create      => POST http://posts.api.url
 * delete      => DELETE http://posts.api.url/123
 *
 * @example
 *
 * import React from 'react';
 * import { Admin, Resource } from 'react-admin';
 * import { microServicesProvider } from '@blackbox-vision/ra-data-microservices';
 *
 * import { PostList } from './posts';
 *
 * const App = () => (
 *     <Admin dataProvider={microServicesProvider({ posts: 'http://path.to.my.api/' })}>
 *         <Resource name="posts" list={PostList} />
 *     </Admin>
 * );
 *
 * export default App;
 */
export const microServicesJsonApiProvider = (
  config: MicroServiceConfig,
  httpClient = fetchUtils.fetchJson,
): DataProvider => ({
  getList: (resource, params) => {
    const { page, perPage } = params.pagination;

    // Create query with pagination params
    const query: any = {
      'page[number]': page,
      'page[size]': perPage,
    };

    // Add all filter params to query
    Object.entries(params.filter || {}).forEach(([key, value]) => {
      query[`filter[${key}]`] = value;
    });

    // Add sort parameters
    if (params.sort && params.sort.field) {
      const prefix = params.sort.order === 'ASC' ? '' : '-';
      query.sort = `${prefix}${params.sort.field}`;
    }

    return httpClient(`${config[resource]}?${stringify(query)}`).then(
      ({ json }) => {
        return {
          total: json.meta.count,
          data: json.data.map((item: any) => mapResponse(item)),
        };
      },
    );
  },

  getOne: (resource, params) =>
    httpClient(`${config[resource]}/${params.id}`).then(({ json }) => ({
      data: mapResponse(json.data),
    })),

  getMany: (resource, params) => {
    const query = {
      'filter[id]': `in:${params.ids.join(',')}`,
    };

    return httpClient(`${config[resource]}?${stringify(query)}`).then(
      ({ json }) => ({
        total: json.meta.count,
        data: json.data.map((item: any) => mapResponse(item)),
      }),
    );
  },

  getManyReference: (resource, params) => {
    const { page, perPage } = params.pagination;

    // Create query with pagination params
    const query: any = {
      'page[number]': page,
      'page[size]': perPage,
    };

    // Add all filter params to query
    Object.entries(params.filter || {}).forEach(([key, value]) => {
      query[`filter[${key}]`] = value;
    });

    // Add the reference id to the filter params
    query[`filter[${params.target}]`] = params.id;

    return httpClient(`${config[resource]}?${stringify(query)}`).then(
      ({ json }) => {
        return {
          total: json.meta.count,
          data: json.data.map((item: any) => mapResponse(item)),
        };
      },
    );
  },

  update: (resource, params) =>
    httpClient(`${config[resource]}/${params.id}`, {
      method: HttpMethods.PATCH,
      body: JSON.stringify({
        data: {
          id: params.id,
          type: resource,
          attributes: params.data,
        },
      }),
    }).then(({ json }) => ({
      data: mapResponse(json.data),
    })),

  updateMany: (resource, params) =>
    Promise.all(
      params.ids.map((id) =>
        httpClient(`${config[resource]}/${id}`, {
          method: HttpMethods.PATCH,
          body: JSON.stringify(params.data),
        }),
      ),
    ).then((responses) => ({
      data: responses.map(({ json }) => json.data.id),
    })),

  create: (resource, params) =>
    httpClient(`${config[resource]}`, {
      method: HttpMethods.POST,
      body: JSON.stringify({
        data: {
          type: resource,
          attributes: params.data,
        },
      }),
    }).then(({ json }) => ({
      data: mapResponse(json.data),
    })),

  delete: (resource, params) =>
    httpClient(`${config[resource]}/${params.id}`, {
      method: HttpMethods.DELETE,
    }).then(({ json }) => ({ data: { id: json.data.id } })),

  deleteMany: (resource, params) =>
    Promise.all(
      params.ids.map((id) =>
        httpClient(`${config[resource]}/${id}`, {
          method: HttpMethods.DELETE,
        }),
      ),
    ).then((responses) => ({
      data: responses.map(({ json }) => json.data.id),
    })),
});
