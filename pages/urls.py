"""URL configuration for pages app"""

from django.urls import path
from . import views

app_name = 'pages'

urlpatterns = [
    path('', views.index, name='index'),
    path('page/create/', views.page_create, name='page_create'),
    path('page/<int:page_id>/update/', views.page_update, name='page_update'),
    path('page/<int:page_id>/delete/', views.page_delete, name='page_delete'),
    path('page/<int:page_id>/move/', views.page_move, name='page_move'),
    path('page/<int:page_id>/export/', views.export_page, name='export_page'),
    path('page/<int:page_id>/export/html/', views.export_page_html, name='export_page_html'),
    path('page/<int:page_id>/icon/', views.page_update_icon, name='page_update_icon'),
    path('page/<int:page_id>/reorder/', views.page_reorder, name='page_reorder'),
    path('api/page/<int:page_id>/', views.api_page_detail, name='api_page_detail'),
    path('api/upload-image/', views.upload_image, name='upload_image'),
]

